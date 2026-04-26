from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken import views as auth_views
from rest_framework.authtoken import views as auth_views

from kyc import views as kyc_views
urlpatterns = [
    path('admin/', admin.site.urls),
    # This enforces the /api/v1/ constraint
    path('api/v1/', include('kyc.urls')), 

    path('api-auth/', include('rest_framework.urls')),

    path('api/v1/login/', auth_views.obtain_auth_token),
    path('api/v1/register/', kyc_views.register_merchant),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)