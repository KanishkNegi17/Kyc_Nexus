from rest_framework import viewsets, permissions, status
from django.contrib.auth.models import User
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework import status
from django.core.exceptions import ValidationError
from .models import KYCSubmission, KYCDocument
from .serializers import KYCSubmissionSerializer
from .serializers import KYCDocumentSerializer

class IsReviewerOrOwner(permissions.BasePermission):
    """
    Custom permission: 
    - Reviewers (is_staff) can access any submission.
    - Merchants can only access their own.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return obj.merchant == request.user
    
class KYCDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = KYCDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return KYCDocument.objects.all()
        return KYCDocument.objects.filter(submission__merchant=self.request.user)

    def perform_create(self, serializer):
        # Security check: Ensure the merchant owns the submission they are attaching files to
        submission = serializer.validated_data['submission']
        if submission.merchant != self.request.user:
            raise ValidationError("You do not have permission to upload to this submission.")
        serializer.save()

class KYCSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = KYCSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsReviewerOrOwner]

    def get_queryset(self):
        # Reviewers see everything, oldest SUBMITTED first for the queue
        if self.request.user.is_staff:
            return KYCSubmission.objects.all().order_by('submitted_at', 'created_at')
        
        # Merchants only see their own submissions
        return KYCSubmission.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        # Automatically assign the logged-in merchant to the submission
        serializer.save(merchant=self.request.user)

    # --- STATE TRANSITION ACTIONS ---

    def _change_state(self, submission, new_state):
        """Helper method to handle transitions and return strict 400 errors."""
        try:
            submission.transition_to(new_state)
            return Response({'status': f'Successfully moved to {new_state}'}, status=status.HTTP_200_OK)
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                # Grab the '__all__' array, and pull out the first string inside it
                error_msg = e.message_dict.get('__all__', ['Validation failed.'])[0]
            else:
                error_msg = str(e.message if hasattr(e, 'message') else e)
            return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def approve(self, request, pk=None):
        submission = self.get_object()
        reason = request.data.get('reason', '')
        if reason:
            submission.reviewer_notes = reason
            submission.save()
        return self._change_state(submission, KYCSubmission.Status.APPROVED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def reject(self, request, pk=None):
        submission = self.get_object()
        reason = request.data.get('reason', '')
        if reason:
            submission.reviewer_notes = reason
            submission.save()
        return self._change_state(submission, KYCSubmission.Status.REJECTED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def request_info(self, request, pk=None):
        submission = self.get_object()
        return self._change_state(submission, KYCSubmission.Status.MORE_INFO_REQUESTED)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Merchant action to submit their draft"""
        submission = self.get_object()
        
        # Ensure only the owner can submit it, not a reviewer
        if request.user.is_staff:
            return Response({'error': 'Reviewers cannot submit KYC forms.'}, status=status.HTTP_403_FORBIDDEN)
            
        return self._change_state(submission, KYCSubmission.Status.SUBMITTED)
@api_view(['POST'])
@permission_classes([AllowAny]) # Anyone can access this to sign up
def register_merchant(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({'error': 'Please provide both username and password.'}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username=username).exists():
        return Response({'error': 'That username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Create the user (Standard users are Merchants by default in our logic)
    user = User.objects.create_user(username=username, password=password)
    
    # Generate their auth token
    token, _ = Token.objects.get_or_create(user=user)
    
    return Response({'token': token.key}, status=status.HTTP_201_CREATED)