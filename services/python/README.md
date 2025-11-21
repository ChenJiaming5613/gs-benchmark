```bash
cd services\python
python -m venv venv
.\venv\Scripts\activate.bat
pip install "fastapi[all]"
pip install matplotlib pillow
```

```bash
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```