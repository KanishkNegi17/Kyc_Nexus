from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from .validators import StrictFileValidator

class KYCSubmission(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        MORE_INFO_REQUESTED = 'more_info_requested', 'More Info Requested'
    reviewer_notes = models.TextField(blank=True, null=True)

    merchant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='kyc_submissions')
    
    # Personal Details (Nullable for Drafts)
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    
    # Business Details
    business_name = models.CharField(max_length=255, blank=True)
    business_type = models.CharField(max_length=100, blank=True)
    expected_monthly_volume_usd = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True) # Used for SLA tracking

    def clean(self):
        super().clean()
        # Enforce that SUBMITTED records have all their fields filled out
        if self.status != self.Status.DRAFT:
            required = ['full_name', 'email', 'phone', 'business_name', 'business_type', 'expected_monthly_volume_usd']
            missing = [field for field in required if not getattr(self, field)]
            if missing:
                raise ValidationError(f"Cannot submit. Missing fields: {', '.join(missing)}")

    def transition_to(self, new_status):
        """Centralized State Machine Logic"""
        valid_transitions = {
            self.Status.DRAFT: [self.Status.SUBMITTED],
            self.Status.SUBMITTED: [self.Status.UNDER_REVIEW, self.Status.MORE_INFO_REQUESTED],
            self.Status.UNDER_REVIEW: [
                self.Status.APPROVED, 
                self.Status.REJECTED, 
            ],
            self.Status.MORE_INFO_REQUESTED: [self.Status.SUBMITTED]
        }

        allowed = valid_transitions.get(self.status, [])
        if new_status not in allowed:
            raise ValidationError(f"Illegal state transition from '{self.status}' to '{new_status}'.")
        
        # If successfully submitted, log the timestamp for SLA tracking
        if new_status == self.Status.SUBMITTED and self.status != self.Status.MORE_INFO_REQUESTED:
            self.submitted_at = timezone.now()

        self.status = new_status
        self.full_clean()
        self.save()

    def __str__(self):
        return f"{self.business_name or 'Draft'} - {self.get_status_display()}"


class KYCDocument(models.Model):
    class DocumentType(models.TextChoices):
        PAN = 'pan', 'PAN'
        AADHAAR = 'aadhaar', 'Aadhaar'
        BANK_STATEMENT = 'bank_statement', 'Bank Statement'

    submission = models.ForeignKey(KYCSubmission, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DocumentType.choices)
    
    # Applying the strict validator here
    file = models.FileField(
        upload_to='kyc_docs/%Y/%m/', 
        validators=[StrictFileValidator(max_size_mb=5)]
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)


class KYCNotification(models.Model):
    """Logs state changes without handling actual email dispatch"""
    submission = models.ForeignKey(KYCSubmission, on_delete=models.CASCADE, related_name='notifications')
    merchant_id = models.IntegerField() 
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Event: {self.event_type} for Submission {self.submission_id}"