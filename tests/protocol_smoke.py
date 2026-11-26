"""Exercise the compiled C++ host against a PTY, never physical hardware."""
import os
from pathlib import Path
import pty
import select
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
HOST = ROOT / 'desktop/vendor/host'

with tempfile.TemporaryDirectory(prefix='ardpic-protocol-') as temp:
    exe = str(Path(temp) / 'ardpicprog')
    subprocess.run(['g++', '-std=c++17', '-O2', '-DARDPICPROG_VERSION="studio-test"', *[str(HOST / f) for f in ['main.cpp', 'serialport.cpp', 'serialport_posix.cpp', 'hexfile.cpp']], '-o', exe], check=True)
    sample = Path(temp) / 'sample.hex'
    sample.write_text(':080000000000000000000028D0\n:00000001FF\n')

    def scenario(label, args, success=False, version='1.8.horo', identity='0561', length='03FF', config='3FFF', packet=None):
        master, slave = pty.openpty()
        proc = subprocess.Popen([exe, '--pic-serial-port', os.ttyname(slave), '--speed', '115200', *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        received, buf = [], b''
        deadline = time.monotonic() + 12
        try:
            while proc.poll() is None and time.monotonic() < deadline:
                if not select.select([master], [], [], .04)[0]: continue
                buf += os.read(master, 2048)
                while b'\n' in buf:
                    line, buf = buf.split(b'\n', 1)
                    cmd = line.strip().decode('ascii', errors='replace')
                    received.append(cmd)
                    if cmd == 'PROGRAM_PIC_VERSION': reply = f'ProgramPIC {version}\n'
                    elif cmd == 'DEVICES': reply = 'OK\npic16f84a* pic16f628a*\n.\n'
                    elif cmd == 'DEVICE': reply = f'OK\nDeviceID: {identity}\nDeviceName: pic16f84a\nProgramRange: 0000-{length}\nConfigRange: 2000-2007\nDataRange: 2100-213F\nConfigWord: {config}\n.\n'
                    elif cmd.startswith('READBIN') and packet is not None:
                        os.write(master, b'OK\n' + bytes([len(packet)]) + packet)
                        continue
                    elif cmd == 'PWROFF': reply = 'OK\n'
                    else: reply = 'ERROR\n'
                    os.write(master, reply.encode('ascii'))
            out, err = proc.communicate(timeout=1)
            assert (proc.returncode == 0) == success, (label, received, out, err)
            assert not any(c.startswith(('ERASE', 'WRITE', 'SETDEVICE')) for c in received), (label, received)
            print('PASS:', label)
        finally:
            if proc.poll() is None: proc.kill(); proc.wait()
            os.close(master); os.close(slave)

    write = ['--device', 'pic16f84a', '--erase', '--burn', '--input-hexfile', str(sample)]
    scenario('read-only exact firmware handshake', ['--list-devices'], True)
    scenario('autodetected PIC16F84A geometry', ['--device', 'auto', '--detect'], True)
    scenario('reject another firmware revision', ['--list-devices'], version='1.0')
    scenario('reject an unknown target ID', write, identity='0000')
    scenario('reject an inconsistent silicon ID', write, identity='1060')
    scenario('reject target name mismatch without manual override', ['--device', 'pic16f628a', '--detect'])
    scenario('reject unexpected device memory geometry', write, length='07FF')
    scenario('reject active code protection before ERASE', write, config='000F')
    scenario('reject force-calibration before ERASE', [*write, '--force-calibration'])
    scenario('reject odd-length serial read packet', ['--device', 'pic16f84a', '--output-hexfile', str(Path(temp) / 'odd.hex')], packet=b'abc')
    scenario('reject oversized serial read packet', ['--device', 'pic16f84a', '--output-hexfile', str(Path(temp) / 'large.hex')], packet=bytes(66))
    print('11 compiled-host protocol checks passed. No physical hardware used.')