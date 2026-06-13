from datetime import datetime, timedelta


def goal_to_dict(g):
    """Convert Goal model to dictionary"""
    return {"id": g.id, "name": g.title, "target": g.target_amount,
            "current": g.current_amount, "monthlyContribution": g.monthly_contribution,
            "date": g.target_date or ""}


def calculate_goal_forecasts(goals, transactions):
    """
    Calculate forecast data for all goals based on transaction history.
    Returns list of forecast dictionaries for each goal.
    """
    now = datetime.utcnow()
    three_months_ago = datetime(now.year, now.month - 2 if now.month > 2 else now.month + 10, 1)
    recent_txs = [t for t in transactions if datetime.strptime(t.date, "%Y-%m-%d") >= three_months_ago]
    income = sum(t.amount for t in recent_txs if t.type == 'income')
    expenses = sum(t.amount for t in recent_txs if t.type == 'expense')
    avg_monthly_savings = (income - expenses) / 3 if len(recent_txs) > 0 else 0
    
    forecasts = []
    for g in goals:
        remaining = g.target_amount - g.current_amount
        contribution = g.monthly_contribution if g.monthly_contribution > 0 else max(0, avg_monthly_savings * 0.3)
        
        if remaining <= 0:
            forecasts.append({
                "goalId": g.id,
                "health": "complete",
                "currentPace": {"months": 0, "date": None},
                "accelerated": {"months": 0, "date": None},
                "aggressive": {"months": 0, "date": None},
                "insights": ["Goal already achieved! 🎉"]
            })
            continue
        
        if contribution <= 0:
            forecasts.append({
                "goalId": g.id,
                "health": "at_risk",
                "currentPace": {"months": None, "date": None},
                "accelerated": {"months": None, "date": None},
                "aggressive": {"months": None, "date": None},
                "insights": ["No savings detected. Start saving to reach this goal."]
            })
            continue
        
        months_current = remaining / contribution
        months_accel = remaining / (contribution * 1.1)
        months_aggr = remaining / (contribution * 1.25)
        
        current_date = (now + timedelta(days=months_current * 30)).strftime("%Y-%m-%d")
        accel_date = (now + timedelta(days=months_accel * 30)).strftime("%Y-%m-%d")
        aggr_date = (now + timedelta(days=months_aggr * 30)).strftime("%Y-%m-%d")
        
        health = "on_track"
        if g.target_date:
            target_dt = datetime.strptime(g.target_date, "%Y-%m-%d")
            forecast_dt = datetime.strptime(current_date, "%Y-%m-%d")
            days_diff = (forecast_dt - target_dt).days
            if days_diff > 60:
                health = "at_risk"
            elif days_diff > 30:
                health = "behind"
        
        insights = []
        if health == "on_track":
            insights.append(f"You're on track to reach this goal by {current_date}.")
        elif health == "behind":
            days_behind = (datetime.strptime(current_date, "%Y-%m-%d") - datetime.strptime(g.target_date, "%Y-%m-%d")).days
            insights.append(f"You may miss your target by {days_behind // 30} month(s).")
        elif health == "at_risk":
            insights.append("Significantly behind schedule. Consider increasing contributions.")
        
        saved_days = (months_current - months_accel) * 30
        if saved_days >= 7:
            insights.append(f"Increasing savings by 10% would shorten completion by {int(saved_days)} days.")
        
        aggr_saved = (months_current - months_aggr) * 30
        if aggr_saved >= 30:
            insights.append(f"An aggressive 25% increase would save {int(aggr_saved // 30)} month(s).")
        
        forecasts.append({
            "goalId": g.id,
            "health": health,
            "currentPace": {"months": round(months_current, 1), "date": current_date},
            "accelerated": {"months": round(months_accel, 1), "date": accel_date},
            "aggressive": {"months": round(months_aggr, 1), "date": aggr_date},
            "insights": insights
        })
    
    return forecasts
