"""Compatibility entry point for the validated training pipeline.

Explicit data generation is separate. Arguments are forwarded to train_validated:
  python train_all_refined.py --data-dir training_data_v6 --activate
"""
from train_validated import main

if __name__ == '__main__':
    main()
