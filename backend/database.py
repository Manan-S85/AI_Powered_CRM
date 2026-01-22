from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["crm"]
leads_collection = db["leads"]
