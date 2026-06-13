from datetime import datetime
from collections import defaultdict


def calculate_financial_health(transactions, profile, budgets, goals, investments):
    """
    Calculate financial health score and components.
    Returns dict with total score, components, and details.
    """
    income = sum(t.amount for t in transactions if t.type == 'income')
    expenses = sum(t.amount for t in transactions if t.type == 'expense')
    
    savings = profile.current_savings if profile else 0
    inv_value = profile.current_investments if profile else 0
    monthly_exp = profile.monthly_expenses if profile else (expenses / max(1, len({t.date[:7] for t in transactions})))
    monthly_inc = profile.monthly_income if profile else (income / max(1, len({t.date[:7] for t in transactions})))
    
    savings_rate = (savings / (monthly_inc * 12)) if monthly_inc > 0 else 0
    savings_rate_score = min(20, savings_rate * 100)
    
    emergency_months = (savings / monthly_exp) if monthly_exp > 0 else 0
    emergency_fund_score = min(20, (emergency_months / 6) * 20)
    
    budget_score = 0
    if budgets:
        met = sum(1 for b in budgets if sum(t.amount for t in transactions if t.type=='expense' and t.category==b.category) <= b.limit_amount)
        budget_score = (met / len(budgets)) * 15
    else:
        budget_score = 10
    
    goal_score = 0
    if goals:
        avg_progress = sum(min(100, (g.current_amount / g.target_amount) * 100 if g.target_amount > 0 else 0) for g in goals) / len(goals)
        goal_score = (avg_progress / 100) * 15
    else:
        goal_score = 5
    
    inv_ratio = (inv_value / savings) if savings > 0 else (1 if inv_value > 0 else 0)
    investment_score = min(15, inv_ratio * 15)
    
    coefficient_of_variation = 0
    if len(transactions) >= 2:
        monthly_expenses = {}
        for t in transactions:
            if t.type == 'expense':
                ym = t.date[:7]
                monthly_expenses[ym] = monthly_expenses.get(ym, 0) + t.amount
        if len(monthly_expenses) >= 2:
            exp_values = list(monthly_expenses.values())
            avg_exp = sum(exp_values) / len(exp_values)
            variance = sum((x - avg_exp) ** 2 for x in exp_values) / len(exp_values)
            std_dev = variance ** 0.5
            coefficient_of_variation = (std_dev / avg_exp) if avg_exp > 0 else 1
            stability_score = max(0, 10 * (1 - min(1, coefficient_of_variation)))
        else:
            stability_score = 5
    else:
        stability_score = 5
    
    net_worth = income - expenses + savings + inv_value
    growth_score = 5 if net_worth > 0 else 2
    
    total = savings_rate_score + emergency_fund_score + budget_score + goal_score + investment_score + stability_score + growth_score
    
    return {
        "total": round(total, 1),
        "components": {
            "savingsRate": round(savings_rate_score, 1),
            "emergencyFund": round(emergency_fund_score, 1),
            "budgetDiscipline": round(budget_score, 1),
            "goalProgress": round(goal_score, 1),
            "investmentActivity": round(investment_score, 1),
            "spendingStability": round(stability_score, 1),
            "netWorthGrowth": round(growth_score, 1)
        },
        "details": {
            "savingsRate": round(savings_rate * 100, 1),
            "emergencyMonths": round(emergency_months, 1),
            "budgetsMet": f"{int(sum(1 for b in budgets if sum(t.amount for t in transactions if t.type=='expense' and t.category==b.category) <= b.limit_amount))}/{len(budgets)}" if budgets else "No budgets",
            "avgGoalProgress": round((sum(min(100, (g.current_amount / g.target_amount) * 100 if g.target_amount > 0 else 0) for g in goals) / len(goals)) if goals else 0, 1),
            "investmentRatio": round(inv_ratio * 100, 1),
            "spendingVariation": round(coefficient_of_variation * 100, 1)
        }
    }


def generate_recommendations(health_data, profile, budgets, transactions):
    """Generate personalized financial recommendations"""
    recommendations = []
    details = health_data["details"]
    comps = health_data["components"]
    
    if comps["savingsRate"] < 15:
        needed = max(0, (0.2 * (profile.monthly_income if profile else 50000) * 12) - (profile.current_savings if profile else 0))
        if needed > 0:
            recommendations.append(f"Increase savings by ₹{int(needed / 12)}/month to improve savings rate score.")
    
    if comps["emergencyFund"] < 15:
        target_months = 6
        current_months = details["emergencyMonths"]
        gap = target_months - current_months
        if gap > 0 and profile:
            recommendations.append(f"Build emergency fund to {target_months} months (₹{int(profile.monthly_expenses * gap)} more) for +{int((gap / 6) * 20)} pts.")
    
    if comps["budgetDiscipline"] < 12 and budgets:
        exceeded = [b for b in budgets if sum(t.amount for t in transactions if t.type=='expense' and t.category==b.category) > b.limit_amount]
        if exceeded:
            recommendations.append(f"Reduce spending in {exceeded[0].category} to stay within budget (+{int(15 - comps['budgetDiscipline'])} pts).")
    
    if comps["goalProgress"] < 10:
        recommendations.append("Increase goal contributions to improve progress score.")
    
    if comps["investmentActivity"] < 10:
        recommendations.append("Consider investing surplus savings to improve investment score.")
    
    if not recommendations:
        recommendations.append("Excellent! Maintain your current financial habits.")
    
    return recommendations[:5]


def calculate_health_changes(current, previous):
    """Calculate changes between current and previous health scores"""
    changes = []
    for key in current["components"]:
        curr = current["components"][key]
        prev = previous["components"][key]
        diff = curr - prev
        if abs(diff) >= 1:
            label = key.replace("Rate", " Rate").replace("Fund", " Fund").replace("Discipline", " Discipline").replace("Progress", " Progress").replace("Activity", " Activity").replace("Stability", " Stability").replace("Growth", " Growth")
            label = ''.join([' ' + c if c.isupper() else c for c in label]).strip()
            if diff > 0:
                changes.append(f"{label} improved this month (+{round(diff, 1)} pts)")
            else:
                changes.append(f"{label} decreased this month ({round(diff, 1)} pts)")
    return changes[:5]


def calculate_net_worth_history(transactions, profile):
    """Calculate net worth history for the last 6 months"""
    base_savings = profile.current_savings if profile else 0
    base_investments = profile.current_investments if profile else 0

    monthly = defaultdict(lambda: {"income": 0, "expense": 0})
    for t in transactions:
        try:
            ym = t.date[:7]
            monthly[ym][t.type] += t.amount
        except Exception:
            pass

    today = datetime.utcnow()
    months = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))

    labels, data = [], []
    cumulative_cash = 0
    for y, m in months:
        ym = f"{y}-{m:02d}"
        inc = monthly[ym]["income"]
        exp = monthly[ym]["expense"]
        cumulative_cash += (inc - exp)
        nw = cumulative_cash + base_savings + base_investments
        labels.append(datetime(y, m, 1).strftime("%b"))
        data.append(round(nw, 2))

    return {"labels": labels, "data": data}
