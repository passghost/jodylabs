import os

def rename_files():
    # Get the current working directory
    directory = os.getcwd()
    
    # List all files in the directory
    files = os.listdir(directory)
    
    # Filter out directories, only keep files
    files = [f for f in files if os.path.isfile(os.path.join(directory, f))]
    
    # Rename files
    for index, filename in enumerate(files, start=1):
        # Get the file extension
        ext = os.path.splitext(filename)[1]
        
        # Create the new filename
        new_name = f"file_{index}{ext}"
        
        # Construct full file paths
        old_file = os.path.join(directory, filename)
        new_file = os.path.join(directory, new_name)
        
        # Rename the file
        os.rename(old_file, new_file)
        print(f'Renamed: "{filename}" to "{new_name}"')

if __name__ == "__main__":
    rename_files()