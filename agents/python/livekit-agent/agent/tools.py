from datetime import datetime

from livekit.agents import RunContext
from livekit.agents.llm import function_tool


class AgentTools:
    @function_tool
    async def get_current_date_and_time(self, context: RunContext) -> str:
        """Get the current date and time."""
        current_datetime = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        return f"The current date and time is {current_datetime}"

