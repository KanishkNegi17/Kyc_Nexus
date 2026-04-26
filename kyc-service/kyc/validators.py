import magic
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

@deconstructible
class StrictFileValidator:
    def __init__(self, max_size_mb=5, allowed_mimes=None):
        self.max_size_bytes = max_size_mb * 1024 * 1024
        # Default to the exact requirements: PDF, JPG, PNG
        self.allowed_mimes = allowed_mimes or ['application/pdf', 'image/jpeg', 'image/png']

    def __call__(self, file):
        # 1. Validate File Size
        if file.size > self.max_size_bytes:
            raise ValidationError(f"File size must be under {self.max_size_bytes / (1024*1024)} MB.")

        # 2. Validate True MIME Type
        file.seek(0)
        # Read the first 2048 bytes to determine the file type
        mime_type = magic.from_buffer(file.read(2048), mime=True)
        file.seek(0) # Reset file pointer for Django to read it later

        if mime_type not in self.allowed_mimes:
            raise ValidationError(f"Unsupported file type: {mime_type}. Allowed types are: PDF, JPG, PNG.")