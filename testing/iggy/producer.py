"""
Test producer for local Apache Iggy server.
Sends 5 batches of 10 messages to sample-stream/sample-topic over TCP.

Usage:
    pip install apache-iggy loguru
    python producer.py
"""

import asyncio

from apache_iggy import IggyClient, StreamDetails, TopicDetails
from apache_iggy import SendMessage as Message
from loguru import logger

SERVER = "localhost:8090"
USERNAME = "iggy"
PASSWORD = "iggy"
STREAM = "sample-stream"
TOPIC = "sample-topic"
PARTITION_ID = 0
BATCHES = 5
MESSAGES_PER_BATCH = 10


async def ensure_stream_and_topic(client: IggyClient) -> None:
    stream: StreamDetails = await client.get_stream(STREAM)
    if stream is None:
        await client.create_stream(name=STREAM)
        logger.info(f"Created stream '{STREAM}'")
    else:
        logger.info(f"Stream '{STREAM}' already exists (id={stream.id})")

    topic: TopicDetails = await client.get_topic(STREAM, TOPIC)
    if topic is None:
        await client.create_topic(
            stream=STREAM,
            name=TOPIC,
            partitions_count=1,
            replication_factor=1,
        )
        logger.info(f"Created topic '{TOPIC}'")
    else:
        logger.info(f"Topic '{TOPIC}' already exists (id={topic.id})")


async def produce(client: IggyClient) -> None:
    logger.info(
        f"Sending {BATCHES} batches of {MESSAGES_PER_BATCH} messages "
        f"to {STREAM}/{TOPIC} partition {PARTITION_ID}"
    )
    msg_id = 0
    for batch in range(1, BATCHES + 1):
        messages = []
        for _ in range(MESSAGES_PER_BATCH):
            msg_id += 1
            messages.append(Message(f"message-{msg_id}"))

        await client.send_messages(
            stream=STREAM,
            topic=TOPIC,
            partitioning=PARTITION_ID,
            messages=messages,
        )
        logger.info(f"Sent batch {batch}/{BATCHES} ({MESSAGES_PER_BATCH} messages)")
        await asyncio.sleep(0.5)

    logger.info("Done — all batches sent.")


async def main() -> None:
    connection_string = f"iggy://{USERNAME}:{PASSWORD}@{SERVER}"
    logger.info(f"Connecting to {connection_string}")

    client = IggyClient.from_connection_string(connection_string)
    await client.connect()
    logger.info("Connected.")

    await ensure_stream_and_topic(client)
    await produce(client)


if __name__ == "__main__":
    asyncio.run(main())
