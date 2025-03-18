import platform

from .code_analysis import handle_tree_sitter_map, tree_sitter_map_tool
from .code_execution import (
    execute_code_tool,
    execute_shell_script_tool,
    handle_execute_code,
    handle_execute_shell_script,
)
from .directory_tools import (
    create_directory_tool,
    directory_tree_tool,
    handle_create_directory,
    handle_directory_tree,
    handle_list_directory,
    list_directory_tool,
)
from .file_tools import (
    delete_file_tool,
    edit_file_tool,
    get_file_info_tool,
    handle_delete_file,
    handle_edit_file,
    handle_get_file_info,
    handle_move_file,
    handle_read_file,
    handle_read_multiple_files,
    handle_search_files,
    handle_write_file,
    move_file_tool,
    read_file_tool,
    read_multiple_files_tool,
    search_files_tool,
    write_file_tool,
)
from .git_tools import (
    git_add_tool,
    git_checkout_tool,
    git_commit_tool,
    git_create_branch_tool,
    git_diff_staged_tool,
    git_diff_tool,
    git_diff_unstaged_tool,
    git_init_tool,
    git_log_tool,
    git_reset_tool,
    git_show_tool,
    git_status_tool,
    handle_git_add,
    handle_git_checkout,
    handle_git_commit,
    handle_git_create_branch,
    handle_git_diff,
    handle_git_diff_staged,
    handle_git_diff_unstaged,
    handle_git_init,
    handle_git_log,
    handle_git_reset,
    handle_git_show,
    handle_git_status,
)
from .image_tools import read_image_file_tool, handle_read_image_file
from .path_tools import (
    get_allowed_directory_tool,
    handle_get_allowed_directory,
    handle_update_allowed_directory,
    update_allowed_directory_tool,
)
from .screenshot_tool import (
    capture_screenshot_tool,
    handle_capture_screenshot,
)
from .system_tools import get_system_info_tool, handle_get_system_info

# Import get_active_apps_tool and get_available_windows_tool safely
# These will be used on all platforms to ensure Linux support works correctly
import sys
import importlib.util

# Define empty placeholders
get_active_apps_tool = None
handle_get_active_apps = None
get_available_windows_tool = None
handle_get_available_windows = None

# Try to import the modules using importlib to avoid exceptions
try:
    # We'll use importlib.util to conditionally import these modules
    spec = importlib.util.find_spec('.get_active_apps_tool', package='aidd.tools')
    if spec is not None:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        get_active_apps_tool = module.get_active_apps_tool
        handle_get_active_apps = module.handle_get_active_apps
    
    spec = importlib.util.find_spec('.get_available_windows_tool', package='aidd.tools')
    if spec is not None:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        get_available_windows_tool = module.get_available_windows_tool
        handle_get_available_windows = module.handle_get_available_windows
except Exception as e:
    # Log the exception but continue
    print(f"Warning: Could not import window management tools: {e}", file=sys.stderr)

# Export all tools definitions
TOOL_DEFINITIONS = [
    get_allowed_directory_tool(),
    write_file_tool(),
    update_allowed_directory_tool(),
    create_directory_tool(),
    edit_file_tool(),
    list_directory_tool(),
    read_file_tool(),
    read_multiple_files_tool(),
    move_file_tool(),
    search_files_tool(),
    delete_file_tool(),
    get_file_info_tool(),
    directory_tree_tool(),
    execute_code_tool(),
    execute_shell_script_tool(),
    tree_sitter_map_tool(),
    # Git tools
    git_init_tool(),
    git_status_tool(),
    git_diff_unstaged_tool(),
    git_diff_staged_tool(),
    git_diff_tool(),
    git_commit_tool(),
    git_add_tool(),
    git_reset_tool(),
    git_log_tool(),
    git_create_branch_tool(),
    git_checkout_tool(),
    git_show_tool(),
    get_system_info_tool(),
    # Screenshot tools
    capture_screenshot_tool(),
    # Image tools
    read_image_file_tool(),
]

# Conditionally add the window management tools
if get_active_apps_tool is not None:
    TOOL_DEFINITIONS.append(get_active_apps_tool())
if get_available_windows_tool is not None:
    TOOL_DEFINITIONS.append(get_available_windows_tool())

# Export all handlers
TOOL_HANDLERS = {
    "get_allowed_directory": handle_get_allowed_directory,
    "update_allowed_directory": handle_update_allowed_directory,
    "list_directory": handle_list_directory,
    "create_directory": handle_create_directory,
    "read_file": handle_read_file,
    "write_file": handle_write_file,
    "edit_file": handle_edit_file,
    "read_multiple_files": handle_read_multiple_files,
    "move_file": handle_move_file,
    "search_files": handle_search_files,
    "delete_file": handle_delete_file,
    "get_file_info": handle_get_file_info,
    "directory_tree": handle_directory_tree,
    "execute_code": handle_execute_code,
    "execute_shell_script": handle_execute_shell_script,
    "tree_sitter_map": handle_tree_sitter_map,
    # Git handlers
    "git_init": handle_git_init,
    "git_status": handle_git_status,
    "git_diff_unstaged": handle_git_diff_unstaged,
    "git_diff_staged": handle_git_diff_staged,
    "git_diff": handle_git_diff,
    "git_commit": handle_git_commit,
    "git_add": handle_git_add,
    "git_reset": handle_git_reset,
    "git_log": handle_git_log,
    "git_create_branch": handle_git_create_branch,
    "git_checkout": handle_git_checkout,
    "git_show": handle_git_show,
    "get_system_info": handle_get_system_info,
    # Screenshot handlers
    "capture_screenshot": handle_capture_screenshot,
    # Image handlers
    "read_image_file": handle_read_image_file,
}

# Conditionally add window management handlers
if handle_get_active_apps is not None:
    TOOL_HANDLERS["get_active_apps"] = handle_get_active_apps
if handle_get_available_windows is not None:
    TOOL_HANDLERS["get_available_windows"] = handle_get_available_windows
