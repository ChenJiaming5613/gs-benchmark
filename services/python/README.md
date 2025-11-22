```bash
cd services\python
python -m venv venv
.\venv\Scripts\activate.bat
pip install "fastapi[all]"
pip install numpy matplotlib pillow plyfile
```

```bash
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```