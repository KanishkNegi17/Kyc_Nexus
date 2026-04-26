from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import KYCSubmission, KYCDocument

class KYCDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCDocument
        fields = ['id', 'submission', 'document_type', 'file', 'uploaded_at']

class KYCSubmissionSerializer(serializers.ModelSerializer):
    documents = KYCDocumentSerializer(many=True, read_only=True)
    at_risk = serializers.SerializerMethodField()

    class Meta:
        model = KYCSubmission
        fields = [
            'id', 'merchant', 'full_name', 'email', 'phone', 
            'business_name', 'business_type', 'expected_monthly_volume_usd', 
            'status', 'created_at', 'updated_at', 'submitted_at', 
            'documents', 'at_risk'
        ]
        # Prevent users from arbitrarily changing their status or timestamps via direct API calls
        read_only_fields = ['merchant', 'status', 'created_at', 'updated_at', 'submitted_at']

    def get_at_risk(self, obj):
        """
        Dynamically calculates if a submission has been sitting in 
        the SUBMITTED queue for more than 24 hours.
        """
        if obj.status == KYCSubmission.Status.SUBMITTED and obj.submitted_at:
            time_in_queue = timezone.now() - obj.submitted_at
            return time_in_queue > timedelta(hours=24)
        return False