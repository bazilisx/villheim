"""Train the keep/drop scorer on Tyler's review: python3 lab/train_scorer.py <features.csv> <out model.json>
Logistic regression on standardised features; reports cross-validated AUC and the strongest signals."""
import csv, json, sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score, StratifiedKFold

rows = list(csv.DictReader(open(sys.argv[1])))
names = [k for k in rows[0] if k not in ('id', 'label')]
lab = [r for r in rows if r['label'] in ('0', '1')]
X = np.array([[float(r[k]) for k in names] for r in lab]); y = np.array([int(r['label']) for r in lab])
mean, std = X.mean(0), X.std(0) + 1e-9
Xs = (X - mean) / std
m = LogisticRegression(C=0.5, class_weight='balanced', max_iter=2000)
auc = cross_val_score(m, Xs, y, cv=StratifiedKFold(5, shuffle=True, random_state=1), scoring='roc_auc')
m.fit(Xs, y)
model = {'names': names, 'mean': mean.tolist(), 'std': std.tolist(), 'w': m.coef_[0].tolist(), 'bias': float(m.intercept_[0]),
         'auc': float(auc.mean()), 'n_kept': int(y.sum()), 'n_dropped': int((1 - y).sum())}
json.dump(model, open(sys.argv[2], 'w'), indent=1)
print('designs', len(y), 'kept', y.sum(), 'AUC %.3f +- %.3f' % (auc.mean(), auc.std()))
for k, w in sorted(zip(names, m.coef_[0]), key=lambda t: -abs(t[1]))[:10]:
    print('  %-14s %+.2f' % (k, w))
