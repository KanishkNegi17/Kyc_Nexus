# 🚀 KYC Nexus - Technical Explainer
This document outlines the core technical implementations, security constraints, and data flows within the backend architecture.


## 1. The State Machine
Where it lives: The state machine is enforced directly at the database model level in kyc/models.py.

### How illegal transitions are prevented:
A dictionary (valid_transitions) maps current states to explicitly allowed future states. If a transition is attempted that violates this mapping, a ValidationError is raised, halting execution before any database write occurs.

```bash

from django.db import models
from django.core.exceptions import ValidationError

class Merchant(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('UNDER_REVIEW', 'Under Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    def transition_to(self, new_status):
        valid_transitions = {
            'DRAFT': ['UNDER_REVIEW'],
            'UNDER_REVIEW': ['APPROVED', 'REJECTED'],
            'APPROVED': [],
            'REJECTED': ['DRAFT']
        }
        
        if new_status not in valid_transitions.get(self.status, []):
            raise ValidationError(f"Illegal transition from {self.status} to {new_status}")
            
        self.status = new_status
        self.save(update_fields=['status'])

```
### 2. The Upload
How validation works: Validation occurs in the Django REST Framework Serializer, ensuring files are inspected for MIME type and size limits before interacting with the model or storage bucket.

What happens to a 50 MB file: It never reaches the Python serializer logic. Django's DATA_UPLOAD_MAX_MEMORY_SIZE (or the production WSGI/Nginx server) intercepts the oversized payload at the network layer and immediately drops it, returning an HTTP 413 Payload Too Large to protect application memory.
```bash

from rest_framework import serializers

class DocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCImage
        fields = ['document']

    def validate_document(self, file):
        max_size = 5 * 1024 * 1024 # 5 MB
        allowed_types = ['image/jpeg', 'image/png', 'application/pdf']

        if file.content_type not in allowed_types:
            raise serializers.ValidationError("Unsupported file format. Use JPG, PNG, or PDF.")
        
        if file.size > max_size:
            raise serializers.ValidationError("File size exceeds the 5MB limit.")
            
        return file
```

### 3. The Queue
Why it was written this way: Instead of loading all "Under Review" records into Python memory and looping through them to check SLA timestamps, .annotate() pushes the boolean calculation down to the database engine (PostgreSQL/SQLite). This ensures query performance and pagination speed remain constant even at scale.

```bash

from django.db.models import Q, ExpressionWrapper, BooleanField
from django.utils.timezone import now
from datetime import timedelta

def get_review_queue():
    sla_threshold = now() - timedelta(hours=48)
    
    return Merchant.objects.filter(
        status='UNDER_REVIEW'
    ).annotate(
        is_sla_breached=ExpressionWrapper(
            Q(submitted_at__lte=sla_threshold), 
            output_field=BooleanField()
        )
    ).order_by('submitted_at')
```
### 4. The Auth
How cross-tenant data leaks are prevented: To prevent Insecure Direct Object Reference (IDOR) vulnerabilities, isolation is enforced at the query level. Overriding the viewset's get_queryset() binds the ORM lookup directly to the authenticated token's user ID.

```bash

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

class MerchantViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MerchantSerializer

    def get_queryset(self):
        # Reviewers have elevated queue access
        if self.request.user.groups.filter(name='Reviewers').exists():
            return Merchant.objects.all()
            
        # Strict isolation: Merchants ONLY see records tied to their User ID
        return Merchant.objects.filter(user=self.request.user)
```
### 5. The AI Audit
**The Scenario:** Generating an API view to allow merchants to patch/update their profile data.

### What the AI generated (Buggy/Insecure):
The AI applied the IsAuthenticated check but completely missed authorization. By fetching the merchant using only pk=pk, Merchant A could pass Merchant B's ID in the URL and arbitrarily overwrite their KYC data.

```bash

# ❌ INSECURE AI CODE
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_merchant(request, pk):
    merchant = get_object_or_404(Merchant, pk=pk) # IDOR Vulnerability
    
    serializer = MerchantSerializer(merchant, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
```

### What it was replaced with (Secure):
Strict ownership validation was added to the database query. By appending user=request.user to the lookup, the database safely returns a 404 Not Found if a user attempts to interact with a record they do not explicitly own.
```bash

# ✅ SECURE REPLACEMENT
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_merchant(request, pk):
    merchant = get_object_or_404(Merchant, pk=pk, user=request.user) # Hard ownership check
    
    serializer = MerchantSerializer(merchant, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
```
**The Scenario:** Generating a read-only endpoint so reviewers can see a list of merchants in the queue.

### What the AI generated (Buggy/Insecure):
The AI took the fastest route possible by using the __all__ meta tag, completely ignoring data privacy.
```bash
# ❌ INSECURE AI CODE
class MerchantQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = '__all__' # Data Leak
```
### What I caught:
Using __all__ is incredibly dangerous in production. By doing this, the API silently exposed highly sensitive database columns to the frontend—including internal reviewer notes, raw tax identification numbers, and password hashes, simply because they existed on the model.

### What it was replaced with (Secure):
I removed __all__ and explicitly whitelisted only the non-sensitive fields required to render the queue UI.
```bash
# ✅ SECURE REPLACEMENT
class MerchantQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        # Strict whitelisting of exposed fields
        fields = ['id', 'business_name', 'status', 'submitted_at']
```
