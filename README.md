# Finora - Personal Finance OS

Finora is a comprehensive personal finance operating system that helps users track their money, analyze spending patterns, set budgets, track goals, and manage investments all in one place. Built with Python, Flask, and Vanilla JS, it emphasizes a clean architecture, blazing-fast responsive UI, and detailed financial health forecasting.

## Key Features

- **OAuth & Secure Authentication**: Fully integrated Google OAuth, secure session management, and email-based verification.
- **Financial Health Scoring**: A unique 7-factor algorithm that scores user financial health based on savings rates, budget adherence, and goal pacing.
- **Goal Forecasting**: Algorithmic predictions for when financial goals will be met based on real-time saving and spending behaviors.
- **Multi-Currency Support**: Fully localized currency formatting based on user preferences.
- **Sleek, Responsive UI**: Built with Tailwind CSS and Vanilla JavaScript to mimic a SPA experience with Dark Mode support and rich empty states.

## Architecture & Tech Stack

- **Backend**: Python 3.12, Flask (Blueprint Architecture)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Frontend**: HTML5, Vanilla ES6 JavaScript (Modularized), Tailwind CSS
- **Design System**: Lucide Icons, Custom Scrollbars, CSS Variables

The backend is cleanly separated into Blueprints (routing), Services (business logic), and Models (data layer), ensuring testability and separation of concerns.

## Local Setup

### 1. Prerequisites
- Python 3.10+
- PostgreSQL
- Git

### 2. Installation
```bash
git clone https://github.com/yourusername/finora.git
cd finora

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory based on `.env.example`:
```env
FLASK_ENV=development
SECRET_KEY=super-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/finora
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
```

### 4. Database Initialization
Create your PostgreSQL database and run the initial setup script:
```bash
./init-db.sh
flask run
```

## Deployment
Finora is configured for direct deployment to Render or Heroku. The repository includes a `Procfile` and `render.yaml` for zero-configuration deployments.

## Future Roadmap
- CSV Bank Statement Imports
- Recurring Transactions (Subscriptions, Rent)
- API Pagination
- Advanced Investment Portfolio Analytics

## License
MIT License
