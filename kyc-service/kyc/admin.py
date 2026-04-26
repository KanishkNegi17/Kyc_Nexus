from django.contrib import admin
from .models import KYCSubmission, KYCDocument, KYCNotification

# Optional: This makes the admin list view much easier to read
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ('id', 'business_name', 'merchant', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('business_name', 'merchant__username', 'email')

admin.site.register(KYCSubmission, KYCSubmissionAdmin)
admin.site.register(KYCDocument)
admin.site.register(KYCNotification)    