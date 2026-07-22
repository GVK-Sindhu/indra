import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import os

# Explicitly configure default Windows installation path for Tesseract OCR
if os.name == 'nt':
    default_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(default_tesseract):
        pytesseract.pytesseract.tesseract_cmd = default_tesseract

def is_tesseract_available() -> bool:
    """
    Checks if the Tesseract OCR executable is available in the runtime environment.
    """
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False

def parse_pdf(file_bytes: bytes) -> list:
    """
    Parses a PDF file from bytes. Extracts text block-by-block with bounding boxes.
    If no text is found, falls back to OCR using PyTesseract.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages_data = []

    for page_idx, page in enumerate(doc):
        # 1. Try standard block-level text extraction
        blocks = page.get_text("blocks")
        page_text = ""
        blocks_data = []

        for block in blocks:
            x0, y0, x1, y1, text, block_no, block_type = block
            cleaned_text = text.strip()
            if not cleaned_text:
                continue
            page_text += cleaned_text + "\n"
            blocks_data.append({
                "content": cleaned_text,
                "boundingBox": {
                    "x": int(x0),
                    "y": int(y0),
                    "w": int(x1 - x0),
                    "h": int(y1 - y0)
                }
            })

        # 2. Fall back to OCR if page text length is 0 (or very short)
        if len(page_text.strip()) < 10:
            if not is_tesseract_available():
                raise ValueError(
                    "OCR is unavailable in this deployment environment. Native text PDFs are supported. "
                    "OCR for scanned documents and images requires the optional Tesseract OCR runtime."
                )
            try:
                # Render page to PNG pixmap
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                # Perform OCR
                ocr_text = pytesseract.image_to_string(img)
                cleaned_ocr = ocr_text.strip()
                
                if len(cleaned_ocr) > 0:
                    page_text = cleaned_ocr
                    blocks_data.append({
                        "content": cleaned_ocr,
                        "boundingBox": {
                            "x": 0,
                            "y": 0,
                            "w": int(page.rect.width),
                            "h": int(page.rect.height)
                        }
                    })
            except ValueError:
                # Re-raise explicit ValueErrors
                raise
            except Exception as ocr_err:
                print(f"[DocumentParser] OCR fallback failed for page {page_idx + 1}: {str(ocr_err)}")

        pages_data.append({
            "pageNumber": page_idx + 1,
            "text": page_text,
            "blocks": blocks_data
        })

    return pages_data

def parse_document(file_bytes: bytes, file_name: str) -> list:
    """
    Parses a document (PDF, Image, Excel, CSV) from bytes.
    Routes parsing logic based on file extension.
    """
    ext = os.path.splitext(file_name)[1].lower()
    
    if ext in [".png", ".jpg", ".jpeg"]:
        print(f"[DocumentParser] Processing Image file: {file_name}")
        if not is_tesseract_available():
            raise ValueError(
                "OCR is unavailable in this deployment environment. Native text PDFs are supported. "
                "OCR for scanned documents and images requires the optional Tesseract OCR runtime."
            )
        try:
            img = Image.open(io.BytesIO(file_bytes))
            ocr_text = pytesseract.image_to_string(img)
            cleaned_ocr = ocr_text.strip()
            if not cleaned_ocr:
                cleaned_ocr = "[Empty Image Document]"
            
            return [{
                "pageNumber": 1,
                "text": cleaned_ocr,
                "blocks": [{
                    "content": cleaned_ocr,
                    "boundingBox": {
                        "x": 0,
                        "y": 0,
                        "w": img.width,
                        "h": img.height
                    }
                }]
            }]
        except Exception as img_err:
            print(f"[DocumentParser] OCR processing failed for image: {str(img_err)}")
            raise ValueError(f"Image OCR processing failed: {str(img_err)}")
            
    elif ext in [".csv"]:
        print(f"[DocumentParser] Processing CSV file: {file_name}")
        return parse_csv(file_bytes, file_name)
        
    elif ext in [".xlsx", ".xls"]:
        print(f"[DocumentParser] Processing Excel file: {file_name}")
        return parse_xlsx(file_bytes, file_name)

    elif ext in [".txt", ".log", ".md"]:
        print(f"[DocumentParser] Processing Text Knowledge file: {file_name}")
        text_content = file_bytes.decode('utf-8', errors='replace').strip()
        if not text_content:
            text_content = f"File: {file_name} [Empty Text Document]"
        return [{
            "pageNumber": 1,
            "text": text_content,
            "blocks": [{
                "content": text_content,
                "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
            }]
        }]
        
    elif ext in [".doc", ".docx"]:
        print(f"[DocumentParser] Word document detected: {file_name}")
        raise ValueError("Format not currently supported in this prototype.")
        
    else:
        # Default to PDF parsing
        return parse_pdf(file_bytes)

def parse_csv(file_bytes: bytes, file_name: str) -> list:
    """
    Parses a CSV file from bytes into page blocks with row ranges and column headers.
    """
    import csv
    text_content = file_bytes.decode('utf-8', errors='replace')
    reader = csv.reader(io.StringIO(text_content))
    rows = list(reader)

    if not rows:
        return [{
            "pageNumber": 1,
            "text": f"File: {file_name} [Empty CSV Document]",
            "blocks": [{
                "content": f"File: {file_name} [Empty CSV Document]",
                "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
            }]
        }]

    header = [str(c).strip() for c in rows[0]]
    data_rows = rows[1:]

    block_size = 20
    blocks_data = []
    full_text_lines = [f"File: {file_name}", f"Columns: {', '.join(header)}"]

    if not data_rows:
        block_text = f"File: {file_name} | Header: {', '.join(header)}"
        blocks_data.append({
            "content": block_text,
            "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
        })
        full_text_lines.append(block_text)
    else:
        for i in range(0, len(data_rows), block_size):
            chunk_rows = data_rows[i : i + block_size]
            start_row = i + 2  # 1-indexed (row 1 is header)
            end_row = start_row + len(chunk_rows) - 1

            block_lines = [
                f"File: {file_name} | Rows {start_row}-{end_row} | Columns: {', '.join(header)}"
            ]
            for row_idx, r in enumerate(chunk_rows):
                actual_row = start_row + row_idx
                cell_pairs = []
                for col_i, val in enumerate(r):
                    val_str = str(val).strip()
                    if val_str:
                        col_name = header[col_i] if col_i < len(header) else f"Col{col_i+1}"
                        cell_pairs.append(f"{col_name}: {val_str}")
                if cell_pairs:
                    block_lines.append(f"Row {actual_row}: " + " | ".join(cell_pairs))

            block_text = "\n".join(block_lines)
            full_text_lines.append(block_text)
            blocks_data.append({
                "content": block_text,
                "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
            })

    return [{
        "pageNumber": 1,
        "text": "\n\n".join(full_text_lines),
        "blocks": blocks_data
    }]

def parse_xlsx(file_bytes: bytes, file_name: str) -> list:
    """
    Parses an Excel (.xlsx / .xls) workbook from bytes into sheet-based page blocks.
    Each sheet maps to a 1-based pageNumber.
    """
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    pages_data = []

    for sheet_idx, sheet_name in enumerate(wb.sheetnames):
        sheet = wb[sheet_name]
        rows = list(sheet.iter_rows(values_only=True))

        if not rows:
            continue

        non_empty_rows = [r for r in rows if any(cell is not None and str(cell).strip() for cell in r)]
        if not non_empty_rows:
            continue

        header = [str(c).strip() if c is not None else f"Col{idx+1}" for idx, c in enumerate(non_empty_rows[0])]
        data_rows = non_empty_rows[1:]

        block_size = 20
        blocks_data = []
        full_text_lines = [f"File: {file_name} | Sheet: {sheet_name}", f"Columns: {', '.join(header)}"]

        if not data_rows:
            block_text = f"File: {file_name} | Sheet: {sheet_name} | Header: {', '.join(header)}"
            blocks_data.append({
                "content": block_text,
                "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
            })
            full_text_lines.append(block_text)
        else:
            for i in range(0, len(data_rows), block_size):
                chunk_rows = data_rows[i : i + block_size]
                start_row = i + 2
                end_row = start_row + len(chunk_rows) - 1

                block_lines = [
                    f"File: {file_name} | Sheet: {sheet_name} | Rows {start_row}-{end_row} | Columns: {', '.join(header)}"
                ]
                for row_idx, r in enumerate(chunk_rows):
                    actual_row = start_row + row_idx
                    cell_pairs = []
                    for col_i, val in enumerate(r):
                        if val is not None and str(val).strip():
                            col_name = header[col_i] if col_i < len(header) else f"Col{col_i+1}"
                            cell_pairs.append(f"{col_name}: {str(val).strip()}")
                    if cell_pairs:
                        block_lines.append(f"Row {actual_row}: " + " | ".join(cell_pairs))

                block_text = "\n".join(block_lines)
                full_text_lines.append(block_text)
                blocks_data.append({
                    "content": block_text,
                    "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
                })

        pages_data.append({
            "pageNumber": sheet_idx + 1,
            "text": "\n\n".join(full_text_lines),
            "blocks": blocks_data
        })

    if not pages_data:
        pages_data.append({
            "pageNumber": 1,
            "text": f"File: {file_name} [Empty Excel Workbook]",
            "blocks": [{
                "content": f"File: {file_name} [Empty Excel Workbook]",
                "boundingBox": {"x": 0, "y": 0, "w": 800, "h": 600}
            }]
        })

    return pages_data

