from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_database: str = "neo4j"
    neo4j_auth_enabled: bool = False
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""
    cors_origins: str = "http://localhost:3000,http://localhost:8501"
    openrouter_api_key: str = ""
    openrouter_model_fast: str = "openai/gpt-4o-mini"
    openrouter_model_strong: str = "anthropic/claude-sonnet-4.5"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()