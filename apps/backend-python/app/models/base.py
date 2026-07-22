from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from bson import ObjectId
from typing import Any
from pydantic_core import core_schema

class PyObjectId(str):
    """
    Custom type mapping MongoDB ObjectId to a string representation in validation schemas.
    """
    @classmethod
    def __get_pydantic_core_schema__(cls, source: Any, handler: Any) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.chain_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.no_info_plain_validator_function(lambda x: str(x))
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(lambda x: str(x))
        )

class CamelModel(BaseModel):
    """
    Standard base model configuration resolving camelCase requests and responses.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True
    )
