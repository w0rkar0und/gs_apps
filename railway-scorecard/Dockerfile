FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY server.py .
COPY scorecard_agent/ scorecard_agent/
COPY onedrive_client/ onedrive_client/

# Create data directories (temporary workspace within container)
RUN mkdir -p /app/data/agent_input /app/data/archived

EXPOSE 3000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "3000"]
