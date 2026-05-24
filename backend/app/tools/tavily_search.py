from typing import Optional

import httpx


class TavilySearchTool:
    name = "tavily_search"

    def __init__(self, api_key: Optional[str], endpoint: str = "https://api.tavily.com/search") -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    def execute(self, payload: dict) -> dict:
        query = payload.get("query")
        if not self.api_key:
            return {
                "status": "configuration_error",
                "message": "TAVILY_API_KEY is required to use tavily_search.",
                "results": [],
            }
        if not query:
            return {"status": "validation_error", "message": "query is required.", "results": []}

        response = httpx.post(
            self.endpoint,
            json={"api_key": self.api_key, "query": query},
            timeout=15.0,
        )
        response.raise_for_status()
        return {"status": "ok", "results": response.json().get("results", [])}
