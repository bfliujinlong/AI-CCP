from app.repositories.user_repo import UserRepository
from app.repositories.customer_repo import CustomerRepository
from app.repositories.opportunity_repo import OpportunityRepository
from app.repositories.factsheet_repo import FactSheetRepository, FactRegistryRepository
from app.repositories.skill_repo import SkillRepository

__all__ = [
    "UserRepository",
    "CustomerRepository",
    "OpportunityRepository",
    "FactSheetRepository",
    "FactRegistryRepository",
    "SkillRepository",
]
