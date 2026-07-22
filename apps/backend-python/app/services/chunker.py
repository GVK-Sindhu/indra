def chunk_document(pages_data: list, max_words: int = 500, overlap_words: int = 50) -> list:
    """
    Chunks parsed page blocks page-by-page. This ensures that every chunk has a 
    strict single pageNumber association, enabling precise page-level provenance.
    If a page exceeds max_words, it splits it using a sliding window.
    """
    chunks = []

    for page in pages_data:
        page_number = page["pageNumber"]
        blocks = page["blocks"]

        if not blocks:
            continue

        current_chunk_words = []
        current_chunk_blocks = []

        for block in blocks:
            block_words = block["content"].split()
            
            # Check if adding this block exceeds word limit
            if len(current_chunk_words) + len(block_words) > max_words:
                if current_chunk_words:
                    # Consolidate bounding boxes in current chunk
                    min_x = min(b["boundingBox"]["x"] for b in current_chunk_blocks)
                    min_y = min(b["boundingBox"]["y"] for b in current_chunk_blocks)
                    max_x = max(b["boundingBox"]["x"] + b["boundingBox"]["w"] for b in current_chunk_blocks)
                    max_y = max(b["boundingBox"]["y"] + b["boundingBox"]["h"] for b in current_chunk_blocks)

                    chunks.append({
                        "pageNumber": page_number,
                        "content": " ".join(current_chunk_words),
                        "boundingBox": {
                            "x": min_x,
                            "y": min_y,
                            "w": max_x - min_x,
                            "h": max_y - min_y
                        }
                    })

                    # Slide chunk window
                    current_chunk_words = current_chunk_words[-overlap_words:] if len(current_chunk_words) > overlap_words else []
                    current_chunk_blocks = current_chunk_blocks[-1:] if current_chunk_blocks else []

            current_chunk_words.extend(block_words)
            current_chunk_blocks.append(block)

        # Emit trailing page chunks
        if current_chunk_words:
            min_x = min(b["boundingBox"]["x"] for b in current_chunk_blocks)
            min_y = min(b["boundingBox"]["y"] for b in current_chunk_blocks)
            max_x = max(b["boundingBox"]["x"] + b["boundingBox"]["w"] for b in current_chunk_blocks)
            max_y = max(b["boundingBox"]["y"] + b["boundingBox"]["h"] for b in current_chunk_blocks)

            chunks.append({
                "pageNumber": page_number,
                "content": " ".join(current_chunk_words),
                "boundingBox": {
                    "x": min_x,
                    "y": min_y,
                    "w": max_x - min_x,
                    "h": max_y - min_y
                }
            })

    return chunks
