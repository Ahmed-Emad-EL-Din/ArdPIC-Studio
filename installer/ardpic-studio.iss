; ArdPIC Studio - single-file Windows x64 installer
; Build:  ISCC.exe installer\ardpic-studio.iss
; The staged portable app folder is produced by CI (see docs/single-exe-installer-plan.md)
; from scripts/package-windows.py and unpacked ZIP.

#define MyAppName "ArdPIC Studio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ahmed Emad El-Din Hussein"
#define MyAppExeName "ArdPIC Studio.exe"

; Absolute path to the staged folder containing "ArdPIC Studio.exe" + "runtime\".
; Override from the command line:  ISCC /DSourceDir=... /DOutputDir=...
#ifndef SourceDir
  #define SourceDir "..\build\staging\ArdPIC Studio"
#endif
#ifndef OutputDir
  #define OutputDir "..\output"
#endif

[Setup]
AppId=ArdPIC Studio.B7E6F2A1-3D48-4C5B-9A2F-1C0E8D5A6B7C
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=ArdPIC-Studio-Setup-{#MyAppVersion}-x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} installer

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
