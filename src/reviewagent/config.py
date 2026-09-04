from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # OpenRouter API Configuration (Free tier models like nvidia/llama-3.1-nemotron-70b-instruct:free)
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    
    # Anthropic API Configuration
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    
    # Default model: OpenRouter Free NVIDIA Nemotron 70B
    model: str = Field(
        default="nvidia/llama-3.1-nemotron-70b-instruct:free", 
        description="LLM model identifier for code reviews"
    )
    provider: Optional[str] = Field(
        default=None, 
        description="LLM provider: 'openrouter' or 'anthropic' (auto-detected if omitted)"
    )
    
    max_chunk_tokens: int = Field(default=3000, description="Approximate token budget per chunk")
    overlap_tokens: int = Field(default=300, description="Token overlap for sliding window")
    session_dir: str = Field(default=".reviewagent_sessions", description="Directory to cache conversation history")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def resolve_provider(self, model_override: Optional[str] = None) -> str:
        """Determines the active provider based on explicitly provided values or keys."""
        if self.provider:
            return self.provider.lower()
        
        target_model = model_override or self.model
        if "nemotron" in target_model.lower() or "/" in target_model or ":free" in target_model:
            return "openrouter"
        if "claude" in target_model.lower():
            return "anthropic"
        
        # Fallback to key presence
        if self.openrouter_api_key:
            return "openrouter"
        if self.anthropic_api_key:
            return "anthropic"
        
        return "openrouter"

