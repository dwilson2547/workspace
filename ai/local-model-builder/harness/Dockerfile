# The sandbox the harness runs each task's tests in: `docker run --network none`, the repo mounted read-only at /src
# and copied to /work, so model-written code never runs on the host or reaches the network.
FROM python:3.13-slim
RUN pip install --no-cache-dir fastapi jinja2 httpx pytest pydantic && pip freeze > /requirements.lock
RUN useradd -m runner
USER runner
WORKDIR /work
