# 🚀KYC Nexus - Full Stack System
KYC Nexus is a comprehensive Know Your Customer (KYC) review platform. It features a React/Vite frontend and a Django REST Framework backend, implementing secure document uploads, state-machine-driven review workflows, and strict cross-tenant data isolation.

# 📋 Prerequisites
Before you begin, ensure you have the following installed on your machine:

- Python (v3.10 or higher)

* Node.js (v18 or higher) & npm

+ Git

# 🚀 Local Setup Instructions
### 1. Clone the Repository
Open your terminal and clone the repository to your local machine:

```bash
git clone https://github.com/your-username/kyc-nexus.git
cd kyc-nexus
```

### 2. Backend Setup (Django)
The backend is built with Django REST Framework and uses a local SQLite database for rapid development.

Open a terminal window and run the following commands:

```Bash
# Navigate to the backend directory
cd kyc-service

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install the required Python packages
pip install -r requirements.txt

# Run database migrations to set up the SQLite tables
python manage.py migrate

# Seed the database with initial test data (Reviewers and Merchants)
python manage.py seed_data

# Start the Django development server
python manage.py runserver
```

The backend API will now be running at http://127.0.0.1:8000/. Keep this terminal window open.

### 3. Frontend Setup (React/Vite)
The frontend is a Single Page Application (SPA) powered by React and Vite.

Open a new terminal window and run the following commands:

```Bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Create a local environment file
# (macOS/Linux)
touch .env
# (Windows)
echo. > .env
```

Open the newly created .env file in your code editor and add the local API route to ensure the frontend connects to your local Django server instead of the live production server:

```bash
Code snippet
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1/
Start the Vite development server:
npm run dev
```
The frontend application will now be running at http://localhost:5173/.

# 🔑 Test Credentials
You can log in immediately using the following credentials:

### Reviewer Account (Access to the Dashboard & Queue):

- Username: admin_reviewer

* Password: password123

### Merchant Account (Access to their specific Draft Application):

- Username: merchant_draft

* Password: password123

# 🏗️ Production Deployment
Frontend: Deployed on Vercel.SPA routing is managed via a vercel.json rewrite configuration to prevent 404s on sub-routes.

Backend: Hosted on PythonAnywhere.