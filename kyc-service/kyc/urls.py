from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KYCSubmissionViewSet, KYCDocumentViewSet

router = DefaultRouter()
router.register(r'kyc', KYCSubmissionViewSet, basename='kyc-submission')
router.register(r'documents', KYCDocumentViewSet, basename='kyc-document')

urlpatterns = [
    path('', include(router.urls)),
]