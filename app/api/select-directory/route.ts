import { NextResponse } from "next/server";
import { platform } from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const WINDOWS_DIALOG_COMMAND = `
Add-Type -AssemblyName System.Windows.Forms;
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
$dialog.Description = "选择本地图片目录";
$dialog.ShowNewFolderButton = $false;
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath;
}
`;

export async function POST() {
  if (platform() !== "win32") {
    return NextResponse.json(
      { error: "仅支持在 Windows 环境下自动选择目录，请手动输入路径" },
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
        { error: "未选择任何目录" },
        { status: 400 }
      );
    }

    return NextResponse.json({ directory });
  } catch (error) {
    console.error("select-directory", error);
    return NextResponse.json(
      { error: "打开目录选择对话框失败，请确认服务器具有图形界面权限" },
      { status: 500 }
    );
  }
}
