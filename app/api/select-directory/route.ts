import { NextResponse } from "next/server";
import { platform } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const WINDOWS_DIALOG_COMMAND = `
Add-Type -AssemblyName System.Windows.Forms;
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
$dialog.Description = "Select a local image directory";
$dialog.ShowNewFolderButton = $false;
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath;
}
`;

export async function POST() {
  if (platform() !== "win32") {
    return NextResponse.json(
      { error: "Automatic directory picker is only available on Windows. Please enter the path manually." },
      { status: 400 }
    );
  }

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      WINDOWS_DIALOG_COMMAND,
    ]);

    const directory = stdout.trim();

    if (!directory) {
      return NextResponse.json(
        { error: "No directory selected." },
        { status: 400 }
      );
    }

    return NextResponse.json({ directory });
  } catch (error) {
    console.error("select-directory", error);
    return NextResponse.json(
      { error: "Failed to open the directory picker. Please ensure the server has GUI permissions." },
      { status: 500 }
    );
  }
}
