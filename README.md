# ComfyUI-TagTable

A custom node for ComfyUI that lets you build prompts from a structured tag table.

## Features

- Editable table with tag and comment fields
- Enable/disable toggle for each row
- Final Prompt preview generated from enabled tags only
- Copy button for quick prompt copying
- Drag-and-drop row reordering
- Delete button for removing rows
- Auto-resizing text areas
- Node size persistence after resize
- Table data persistence between sessions

## Node

**Tag Table**

### Inputs
- **rows** - number of rows in the table
- **table_data** - internal JSON data used to store table state

### Output
- **tags_text** - final prompt string built from all enabled tag rows

## How it works

Each row contains:
- an enable checkbox
- a tag field
- a comment field

Only enabled rows with non-empty tags are included in the final output string.

The **Final Prompt** area shows the combined result in real time.

## Installation

Clone this repository into your `ComfyUI/custom_nodes` folder:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/xelavi9966-cell/ComfyUI-TagTable.git
```

Then restart ComfyUI.

## Update

To update the node:

```bash
cd ComfyUI/custom_nodes/ComfyUI-TagTable
git pull
```

## Notes

- Comments are for organization only and are not included in the output
- Only enabled rows with filled tag values are used in the final prompt
- The node is intended for convenient prompt building inside ComfyUI

## License

MIT