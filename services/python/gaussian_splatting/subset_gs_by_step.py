import argparse
from pathlib import Path

import numpy as np
from plyfile import PlyData, PlyElement


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Down-sample a 3D Gaussian Splatting PLY file by selecting every Nth vertex."
    )
    parser.add_argument("ply_path", type=Path, help="Path to the input 3DGS PLY file.")
    parser.add_argument(
        "--step",
        type=int,
        nargs="+",
        default=[1],
        metavar="STEP",
        help="One or more positive strides for vertex selection (default: 1).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional output file path. Defaults to point_cloud_down_{step}.ply next to the input file.",
    )
    return parser.parse_args()


def step_vertices(vertex_element, step: int):
    vertices = vertex_element.data
    stepped = np.ascontiguousarray(vertices[::step])
    if stepped.size == 0:
        raise ValueError("Step selection removed all vertices. Reduce the step size.")
    return PlyElement.describe(stepped, vertex_element.name)


def step_ply(plydata: PlyData, step: int, output_path: Path) -> None:
    vertex_elements = [el for el in plydata.elements if el.name == "vertex"]
    if len(vertex_elements) != 1:
        raise ValueError("Expected exactly one 'vertex' element in the PLY file.")

    stepped_vertex = step_vertices(vertex_elements[0], step)

    vertex_count = len(stepped_vertex.data)

    new_elements = [stepped_vertex if el.name == "vertex" else el for el in plydata.elements]

    PlyData(
        new_elements,
        text=plydata.text,
        byte_order=plydata.byte_order,
        comments=list(plydata.comments),
        obj_info=list(plydata.obj_info),
    ).write(str(output_path))

    print(f"Saved {vertex_count} vertices to {output_path}")


def main() -> None:
    args = parse_args()
    input_path: Path = args.ply_path
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    steps = []
    for step in args.step:
        if step <= 0:
            raise ValueError(f"Sampling steps must be positive integers, got {step}.")
        if step not in steps:
            steps.append(step)

    if args.output and len(steps) > 1:
        raise ValueError("--output can only be used when specifying a single step value.")

    plydata = PlyData.read(str(input_path))

    for step in steps:
        if args.output:
            output_path = args.output
        else:
            output_path = input_path.with_name(f"point_cloud_step_{step}.ply")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        step_ply(plydata, step, output_path)


if __name__ == "__main__":
    main()
