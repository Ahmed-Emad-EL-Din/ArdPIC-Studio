#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <string>

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    wchar_t file[32768] = {};
    const DWORD n = GetModuleFileNameW(nullptr, file, 32768);
    if (n == 0 || n >= 32768) return 1;
    const std::wstring path(file, n);
    const auto base = path.substr(0, path.find_last_of(L"\\/")) + L"\\runtime";
    const auto program = base + L"\\electron.exe";
    STARTUPINFOW start = {};
    start.cb = sizeof(start);
    PROCESS_INFORMATION process = {};
    // Resolve only the packaged executable, never another copy from PATH.
    if (!CreateProcessW(program.c_str(), nullptr, nullptr, nullptr, FALSE, 0,
                        nullptr, base.c_str(), &start, &process)) {
        MessageBoxW(nullptr, L"Extract the complete portable ZIP before launching ArdPIC Studio. The runtime folder must remain beside this executable.", L"ArdPIC Studio", MB_ICONERROR | MB_OK);
        return 1;
    }
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return 0;
}