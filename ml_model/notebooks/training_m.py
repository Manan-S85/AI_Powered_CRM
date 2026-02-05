import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score, precision_score, recall_score
import warnings
warnings.filterwarnings('ignore')

print("🚀 Starting ML Model Training for Lead Temperature Classification (Hot/Warm/Cold)")
print("="*80)

# ----------------------------
# STEP 1: Load Enhanced Dataset (created by enhance_dataset.py)
# ----------------------------
print("📊 Loading Enhanced_Leads.csv dataset...")
df = pd.read_csv("../Enhanced_Leads.csv")
print(f"Dataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")

print("\n🌡️ Lead Temperature distribution:")
print(df['Lead Temperature'].value_counts())

# Target: Lead Temperature (Hot/Warm/Cold)
target = "Lead Temperature"

# Drop rows without label
df = df.dropna(subset=[target])
print(f"After dropping null targets: {df.shape}")

# Features — all except target + identifiers
columns_to_drop = [target, "Lead Number", "Prospect ID", "Converted", "Email id", "Phone Number", "Full Name"]
X = df.drop(columns=columns_to_drop, errors="ignore")
y = df[target]

print(f"Features shape: {X.shape}")
print(f"Target shape: {y.shape}")
print(f"Target classes: {sorted(y.unique())}")

# Identify categorical vs numeric columns properly
cat_cols = []
num_cols = []

for col in X.columns:
    try:
        pd.to_numeric(X[col], errors='raise')
        num_cols.append(col)
    except:
        cat_cols.append(col)

print(f"\n📊 Categorical columns ({len(cat_cols)}): {cat_cols[:10]}...")  # Show first 10
print(f"📊 Numerical columns ({len(num_cols)}): {num_cols}")

# ----------------------------
# STEP 2: Preprocessing Pipeline
# ----------------------------
categorical_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
])

numerical_pipeline = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler())
])

preprocessor = ColumnTransformer([
    ('cat', categorical_pipeline, cat_cols),
    ('num', numerical_pipeline, num_cols)
], remainder='drop')

# ----------------------------
# STEP 3: Train/Test Split
# ----------------------------
print("\n🔄 Splitting data...")
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"Training set: {X_train.shape}")
print(f"Test set: {X_test.shape}")
print(f"Training target distribution:")
print(pd.Series(y_train).value_counts())

# ----------------------------
# STEP 4: Define Models to Try
# ----------------------------
models_to_try = {
    "Random Forest": RandomForestClassifier(random_state=42),
    "Gradient Boosting": GradientBoostingClassifier(random_state=42),
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "SVM": SVC(probability=True, random_state=42)
}

best_model = None
best_score = 0
best_model_name = ""
model_results = {}

scoring_metric = 'f1_macro'

# ----------------------------
# STEP 5: Train & Evaluate Models
# ----------------------------
print("\n🤖 Training multiple models for Lead Temperature Classification...")
print("=" * 80)

for model_name, model in models_to_try.items():
    print(f"\n🔍 Training {model_name}...")
    pipeline = Pipeline([
        ('preprocess', preprocessor),
        ('model', model)
    ])
    
    # Cross-validation
    cv_scores = cross_val_score(pipeline, X_train, y_train,
                                cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
                                scoring=scoring_metric)
    print(f"   CV F1-Macro: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")
    
    # Fit pipeline
    pipeline.fit(X_train, y_train)
    
    # Predict test set
    y_pred = pipeline.predict(X_test)
    
    # Calculate metrics for multi-class
    f1_macro = f1_score(y_test, y_pred, average='macro')
    f1_weighted = f1_score(y_test, y_pred, average='weighted')
    accuracy = accuracy_score(y_test, y_pred)
    precision_macro = precision_score(y_test, y_pred, average='macro')
    recall_macro = recall_score(y_test, y_pred, average='macro')
    
    model_results[model_name] = {
        'pipeline': pipeline,
        'f1_macro': f1_macro,
        'f1_weighted': f1_weighted,
        'accuracy': accuracy,
        'precision_macro': precision_macro,
        'recall_macro': recall_macro,
        'y_pred': y_pred
    }
    
    print(f"   📊 Results:")
    print(f"      Accuracy: {accuracy:.4f}")
    print(f"      Precision (Macro): {precision_macro:.4f}")
    print(f"      Recall (Macro): {recall_macro:.4f}")
    print(f"      F1-Score (Macro): {f1_macro:.4f}")
    print(f"      F1-Score (Weighted): {f1_weighted:.4f}")
    
    if f1_macro > best_score:
        best_score = f1_macro
        best_model = pipeline
        best_model_name = model_name

print("\n" + "="*80)
print(f"🏆 BEST MODEL: {best_model_name} (F1-Macro: {best_score:.4f})")
print("="*80)

# ----------------------------
# STEP 6: Detailed Evaluation of Best Model
# ----------------------------
print(f"\n📈 DETAILED EVALUATION - {best_model_name}")
print("-" * 50)

best_results = model_results[best_model_name]
y_pred_best = best_results['y_pred']

# Classification report for multi-class
print("\n📊 Classification Report:")
print(classification_report(y_test, y_pred_best))

# Confusion Matrix
print("\n🔥 Confusion Matrix:")
cm = confusion_matrix(y_test, y_pred_best)
print("       Cold  Hot  Warm")
for i, row in enumerate(cm):
    labels = ['Cold ', 'Hot  ', 'Warm ']
    print(f"{labels[i]} {row}")

# Per-class performance
print("\n🎯 Per-Class Performance:")
class_report = classification_report(y_test, y_pred_best, output_dict=True)
for class_name in ['Cold', 'Hot', 'Warm']:
    if class_name in class_report:
        metrics = class_report[class_name]
        print(f"{class_name:5}: Precision: {metrics['precision']:.3f} | Recall: {metrics['recall']:.3f} | F1: {metrics['f1-score']:.3f} | Support: {int(metrics['support'])}")

# Model Performance Summary
print(f"\n🎯 FINAL MODEL PERFORMANCE SUMMARY - Lead Temperature Classification")
print("=" * 70)
for model_name, results in model_results.items():
    status = "🏆 BEST" if model_name == best_model_name else "   "
    print(f"{status} {model_name:20} | F1-Macro: {results['f1_macro']:.4f} | "
          f"Acc: {results['accuracy']:.4f} | F1-Weighted: {results['f1_weighted']:.4f}")

# ----------------------------
# STEP 7: Save Model and Metadata
# ----------------------------
models_dir = "../models"
os.makedirs(models_dir, exist_ok=True)

print(f"\n💾 SAVING LEAD TEMPERATURE MODELS...")
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
model_filename = f"best_lead_temperature_model_{best_model_name.lower().replace(' ', '_')}_{timestamp}.pkl"
model_path = os.path.join(models_dir, model_filename)

# Save both timestamped and main model
joblib.dump(best_model, model_path)
joblib.dump(best_model, os.path.join(models_dir, "lead_temperature_model.pkl"))

print(f"✅ Best temperature model saved as: {model_filename}")
print(f"✅ Main temperature model saved as: lead_temperature_model.pkl")

# Save model metadata for temperature classification
metadata = {
    'model_name': best_model_name,
    'model_type': 'multi_class_classification',
    'target_classes': sorted(y.unique()),
    'training_date': datetime.now().isoformat(),
    'dataset_shape': df.shape,
    'features_count': len(X.columns),
    'target_column': target,
    'performance': {
        'accuracy': float(best_results['accuracy']),
        'precision_macro': float(best_results['precision_macro']),
        'recall_macro': float(best_results['recall_macro']),
        'f1_macro': float(best_results['f1_macro']),
        'f1_weighted': float(best_results['f1_weighted'])
    },
    'class_distribution': y.value_counts().to_dict(),
    'feature_columns': list(X.columns),
    'categorical_columns': cat_cols,
    'numerical_columns': num_cols
}

metadata_path = os.path.join(models_dir, "temperature_model_metadata.json")
import json
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"✅ Temperature model metadata saved as: temperature_model_metadata.json")

print(f"\n🎉 LEAD TEMPERATURE MODEL TRAINING COMPLETED SUCCESSFULLY!")
print(f"🏆 Best Model: {best_model_name}")
print(f"📊 Best F1-Macro Score: {best_score:.4f}")
print(f"📁 Models saved in: {models_dir}")
print(f"🌡️  Target Classes: {sorted(y.unique())}")
print(f"🎯 Model can now classify leads as: Hot, Warm, or Cold")
print("=" * 80)
