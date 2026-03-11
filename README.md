# ComfyUI Tag Table Node

A custom node for ComfyUI that allows building prompts using a table structure.

Instead of writing one long prompt string, you can organize tags in rows, enable or disable them, and see the final compiled prompt instantly.

This is especially useful for complex prompts, LoRA workflows, and prompt experimentation.

---

# Features

• Table-based prompt building  
• Enable / disable individual rows  
• Multi-line text support  
• Comment field for notes (not included in prompt)  
• Real-time final prompt preview  
• Clean prompt output without automatic commas  

Only enabled rows are included in the final prompt.

---

# Why this node is useful

When working with Stable Diffusion or SDXL, prompts often contain many elements:

- quality tags
- character description
- clothing
- pose
- environment
- lighting
- style modifiers

Instead of constantly editing a long string, this node lets you manage prompts as modular blocks.

You can quickly toggle parts of the prompt on or off and experiment much faster.

---

# Node Interface

Each row contains:

Tag – the prompt text  
Comment – optional note (not included in the final prompt)  
Toggle – enable or disable the row

The node automatically composes the **Final Prompt** from all enabled rows.

---

# Installation

1. Open your ComfyUI folder

2. Go to

3. Clone the repository: https://github.com/xelavi9966-cell/ComfyUI-TagTable.git

Or download and extract the repository into the `custom_nodes` folder.

4. Restart ComfyUI.

---


# File structure
