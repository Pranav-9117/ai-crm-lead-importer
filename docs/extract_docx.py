import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r'd:\ai-crm-lead-importer\CRM_Importer_Specification_v2_Updated.docx'
txt_path = r'd:\ai-crm-lead-importer\CRM_Importer_Specification_v2_Updated.txt'

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read('word/document.xml')

tree = ET.fromstring(xml_content)
# XML namespace for WordprocessingML
namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

# Extract paragraphs
paragraphs = []
for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
    texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
    if texts:
        paragraphs.append(''.join(texts))
    else:
        paragraphs.append('')

with open(txt_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(paragraphs))

print(f"Extracted {len(paragraphs)} paragraphs to {txt_path}")
