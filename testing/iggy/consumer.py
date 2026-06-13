"""
Test consumer for local Apache Iggy server.
Polls sample-stream/sample-topic over TCP, printing each message.
Run this after (or alongside) producer.py.

Usage:
    pip install apache-iggy loguru
    python consumer.py
"""

import asyncio

from apache_iggy import IggyClient, PollingStrategy, ReceiveMessage
from loguru import logger

SERVER = "localhost:8090"
USERNAME = "iggy"
PASSWORD = "iggy"
STREAM = "sample-stream"
TOPIC = "sample-topic"
PARTITION_ID = 0
BATCHES = 5
MESSAGES_PER_BATCH = 10


async def consume(client: IggyClient) -> None:
    logger.info(
        f"Polling {STREAM}/{TOPIC} partition {PARTITION_ID} "
        f"for up to {BATCHES} batches"
    )
    batches_consumed = 0
    while batches_consumed < BATCHES:
        polled = await client.poll_messages(
            stream=STREAM,
            topic=TOPIC,
            partition_id=PARTITION_ID,
            polling_strategy=PollingStrategy.Next(),
            count=MESSAGES_PER_BATCH,
            auto_commit=True,
        )

        if not polled:
            logger.info("No messages yet — waiting...")
            await asyncio.sleep(0.5)
            continue

        for msg in polled:
            handle_message(msg)

        batches_consumed += 1
        logger.info(f"Consumed batch {batches_consumed}/{BATCHES}")
        await asyncio.sleep(0.5)

    logger.info("Done — all batches consumed.")


def handle_message(msg: ReceiveMessage) -> None:
    payload = msg.payload().decode("utf-8")
    logger.info(f"  offset={msg.offset()}  payload={payload}")


async def main() -> None:
    connection_string = f"iggy://{USERNAME}:{PASSWORD}@{SERVER}"
    logger.info(f"Connecting to {connection_string}")

    client = IggyClient.from_connection_string(connection_string)
    await client.connect()
    logger.info("Connected.")

    await consume(client)


if __name__ == "__main__":
    asyncio.run(main())
