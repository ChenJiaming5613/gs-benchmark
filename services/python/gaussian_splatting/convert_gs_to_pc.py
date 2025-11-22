import os
import tempfile
import shutil
import numpy as np
from plyfile import PlyData, PlyElement
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

router = APIRouter()

def SH2RGB(sh):
    C0 = 0.28209479177387814
    return sh * C0 + 0.5

def convert_gs_to_pc(input_path: str, output_path: str):
    """
    Executes the specific conversion logic: reads input_path, processes data, writes to output_path.
    """
    try:
        # Read PLY
        plydata = PlyData.read(input_path)
        
        # Check if vertex element exists
        if 'vertex' not in plydata:
            raise ValueError("Invalid PLY file: 'vertex' element not found.")
            
        vertex = plydata['vertex']

        # Extract coordinates
        x = np.asarray(vertex['x'])
        y = np.asarray(vertex['y'])
        z = np.asarray(vertex['z'])
        num_points = len(x)

        # Extract Spherical Harmonics coefficients (DC component)
        # Check if necessary properties exist
        required_props = ['f_dc_0', 'f_dc_1', 'f_dc_2']
        for prop in required_props:
            if prop not in vertex:
                raise ValueError(f"Invalid 3DGS PLY: Missing property '{prop}'")

        f_dc_0 = np.asarray(vertex['f_dc_0'])
        f_dc_1 = np.asarray(vertex['f_dc_1'])
        f_dc_2 = np.asarray(vertex['f_dc_2'])
        sh_dc = np.stack([f_dc_0, f_dc_1, f_dc_2], axis=1)

        # Convert colors
        rgb_float = SH2RGB(sh_dc)
        rgb_float = np.clip(rgb_float, 0.0, 1.0)
        colors = (rgb_float * 255).astype(np.uint8)

        # Generate zero normals
        normals = np.zeros((num_points, 3), dtype=np.float32)

        # Define output format
        dtype_full = [
            ('x', 'f4'), ('y', 'f4'), ('z', 'f4'),
            ('nx', 'f4'), ('ny', 'f4'), ('nz', 'f4'),
            ('red', 'u1'), ('green', 'u1'), ('blue', 'u1')
        ]
        
        elements = np.empty(num_points, dtype=dtype_full)
        
        elements['x'] = x
        elements['y'] = y
        elements['z'] = z
        elements['nx'] = normals[:, 0]
        elements['ny'] = normals[:, 1]
        elements['nz'] = normals[:, 2]
        elements['red'] = colors[:, 0]
        elements['green'] = colors[:, 1]
        elements['blue'] = colors[:, 2]

        # Save
        el = PlyElement.describe(elements, 'vertex')
        PlyData([el], text=False).write(output_path)
    
    except Exception as e:
        # Catch all errors during conversion and raise them to be handled at the API layer
        raise RuntimeError(f"Processing failed: {str(e)}")

def remove_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"Error removing temp file {path}: {e}")

@router.post("/convert_gs_to_pc")
async def convert_gs_to_pc_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # 1. Simple validation of file extension
    if not file.filename.lower().endswith('.ply'):
        raise HTTPException(status_code=400, detail="File must be a .ply file")

    # Create temporary file paths
    # delete=False allows us to close the file and reopen it for reading/writing, background_tasks handles final deletion
    input_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".ply")
    output_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".ply")
    
    input_path = input_tmp.name
    output_path = output_tmp.name

    # Close temp file handles to avoid file locking issues on Windows
    input_tmp.close()
    output_tmp.close()

    try:
        # 2. Write uploaded file to temp input file
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # 3. Execute conversion
        convert_gs_to_pc(input_path, output_path)
        
        # 4. Set cleanup tasks after response (delete input and output temp files)
        background_tasks.add_task(remove_file, input_path)
        background_tasks.add_task(remove_file, output_path)
        
        # 5. Generate download filename
        original_name = os.path.splitext(file.filename)[0]
        download_name = f"points3D.ply"

        # 6. Return file stream
        return FileResponse(
            path=output_path, 
            filename=download_name,
            media_type="application/octet-stream"
        )

    except RuntimeError as e:
        # Conversion logic error
        remove_file(input_path)
        remove_file(output_path)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # Other unknown errors
        remove_file(input_path)
        remove_file(output_path)
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
