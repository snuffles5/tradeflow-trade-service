from functools import lru_cache


@lru_cache(maxsize=None)
def snake_to_camel(snake_str):
    # If the key doesn't contain an underscore, return it unchanged.
    if '_' not in snake_str:
        return snake_str
    parts = snake_str.split('_')
    return parts[0] + ''.join(word.title() for word in parts[1:])


def dict_keys_to_camel(obj):
    _dict_keys_to_camel = dict_keys_to_camel  # local reference for recursion
    _snake_to_camel = snake_to_camel  # local reference to cached converter
    if isinstance(obj, dict):
        # Use dictionary comprehension and only convert keys containing '_'
        return {
            (k if '_' not in k else _snake_to_camel(k)): _dict_keys_to_camel(v)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [_dict_keys_to_camel(item) for item in obj]
    else:
        return obj
