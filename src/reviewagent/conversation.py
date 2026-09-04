import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class Conversation(BaseModel):
    file_path: str
    file_content: str
    system_prompt: str = (
        "You are an expert Python reviewer with deep context on this file. "
        "Answer follow-up questions accurately with direct references to the code and findings."
    )
    messages: List[Message] = Field(default_factory=list)

    def add_user_message(self, text: str) -> None:
        self.messages.append(Message(role="user", content=text))

    def add_assistant_message(self, text: str) -> None:
        self.messages.append(Message(role="assistant", content=text))

    def ask(self, client: Any, model: str, question: str) -> str:
        self.add_user_message(question)

        full_system = f"{self.system_prompt}\n\nTarget File: {self.file_path}\nFile Content:\n```python\n{self.file_content}\n```"

        # Check if OpenAI-compatible (OpenRouter for Nemotron)
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            api_messages = [{"role": "system", "content": full_system}] + [
                {"role": m.role, "content": m.content} for m in self.messages
            ]
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,
                max_tokens=3000,
                temperature=0.2,
            )
            response_text = response.choices[0].message.content or ""
            self.add_assistant_message(response_text)
            return response_text

        # Anthropic API
        if hasattr(client, "messages") and hasattr(client.messages, "create"):
            api_messages = [{"role": m.role, "content": m.content} for m in self.messages]
            response = client.messages.create(
                model=model,
                max_tokens=3000,
                system=full_system,
                messages=api_messages,
            )
            response_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

            self.add_assistant_message(response_text)
            return response_text

        raise TypeError(f"Unsupported LLM client type for conversation: {type(client)}")


    def save(self, directory: str) -> str:
        dir_path = Path(directory)
        dir_path.mkdir(parents=True, exist_ok=True)
        # Safe filename from relative path
        safe_name = self.file_path.replace("/", "__").replace("\\", "__") + ".json"
        save_path = dir_path / safe_name
        
        save_path.write_text(self.model_dump_json(indent=2), encoding="utf-8")
        return str(save_path)

    @classmethod
    def load(cls, file_path_or_session_file: str, session_dir: Optional[str] = None) -> "Conversation":
        path = Path(file_path_or_session_file)
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            return cls(**data)

        if session_dir:
            safe_name = file_path_or_session_file.replace("/", "__").replace("\\", "__") + ".json"
            candidate = Path(session_dir) / safe_name
            if candidate.is_file():
                data = json.loads(candidate.read_text(encoding="utf-8"))
                return cls(**data)

        raise FileNotFoundError(f"No conversation session found for '{file_path_or_session_file}'")
