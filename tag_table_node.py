import json


class TagTableNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "rows": ("INT", {
                    "default": 5,
                    "min": 1,
                    "max": 100,
                    "step": 1
                }),
                "table_data": ("STRING", {
                    "default": "[]",
                    "multiline": True
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("tags_text",)
    FUNCTION = "build_text"
    CATEGORY = "LeraTools"

    def build_text(self, rows, table_data):
        try:
            data = json.loads(table_data)
            if not isinstance(data, list):
                data = []
        except Exception:
            data = []

        parts = []
        for row in data:
            if not isinstance(row, dict):
                continue

            enabled = bool(row.get("enabled", True))
            if not enabled:
                continue

            tag = str(row.get("tag", "")).strip()
            if tag:
                parts.append(tag)

        result = " ".join(parts)
        return (result,)


NODE_CLASS_MAPPINGS = {
    "TagTableNode": TagTableNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TagTableNode": "Tag Table"
}