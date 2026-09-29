from collections.abc import Iterable
from neo4j import Driver, GraphDatabase
from app.config import Settings


class Neo4jRepository:
    def __init__(self, settings: Settings) -> None:
        auth = (settings.neo4j_username, settings.neo4j_password) if settings.neo4j_auth_enabled else None
        self.database = settings.neo4j_database
        self.driver: Driver = GraphDatabase.driver(settings.neo4j_uri, auth=auth)

    def close(self) -> None:
        self.driver.close()

    def query(self, cypher: str, parameters: dict | None = None) -> list[dict]:
        with self.driver.session(database=self.database) as session:
            return [record.data() for record in session.run(cypher, parameters or {})]

    def execute(self, cypher: str, parameters: dict | None = None) -> None:
        with self.driver.session(database=self.database) as session:
            session.run(cypher, parameters or {}).consume()

    def verify_connectivity(self) -> None:
        self.driver.verify_connectivity()