# Memory forensics with Volatility 3: A deep dive into MemLabs Lab 6

## Introduction

Memory forensics is an essential discipline in digital investigations. Whether we are hunting sophisticated threats, analyzing malware behavior, or solving CTF challenges, volatile memory gives us actionable intelligence that disk analysis alone cannot provide. Disk images show what was written to storage, but memory preserves the live execution state: active network connections, injected code, decrypted credentials, and ephemeral processes that never touched a file system.

In this guide, we explore memory analysis using Volatility 3, the open-source framework for memory forensics. We walk through both the theoretical foundations of memory dumps and practical investigation techniques by solving MemLabs Lab 6 ("The Reckoning"), examining how kernel structures map to analyst commands.

## Part 1: Understanding memory dumps

### What are memory dumps?

A memory dump (also called a memory image or RAM dump) is a snapshot of physical memory (RAM) at a specific moment in time. It serves as a freeze-frame of everything running inside the operating system: active processes, open sockets, decrypted text, encryption keys, cached credentials, and even recently deleted data that has not yet been overwritten in memory cells.

Capturing RAM preserves this volatile state, allowing us to reconstruct user activity, trace process execution trees, and extract artifacts that leave no traces on disk.

### Why memory dumps matter

Disk forensics inspects long-term storage like file systems, partition tables, and event logs. Memory forensics inspects the live, ephemeral state of the system that vanishes when the machine loses power.

Key reasons memory forensics matters:

* Live execution state: Reveals active processes, running threads, open handles, and loaded modules at the exact moment of capture.
* Decrypted data: Data encrypted on disk or across TLS connections is frequently decrypted in memory for processing.
* Network activity: Shows active TCP and UDP sockets, listening services, and raw packet buffers that may never appear in disk logs.
* In-memory malware: Detects code injection, process hollowing, reflective DLL loading, and kernel hooks that bypass file scanners.
* User activity: Uncovers command-line inputs, open browser tabs, clipboard contents, and active chat messages.

Memory forensics reveals what the system was doing, not just what was stored.

### Types of memory dumps

Depending on the acquisition mechanism and operating system settings, memory images arrive in several formats:

1. Full memory dump: Captures all physical RAM, covering both user-space and kernel-space memory pages. The file size matches installed physical memory (for example, a 16 GB machine produces a 16 GB dump). This is the most comprehensive format for forensic reconstruction.
2. Kernel memory dump: Contains only kernel-mode memory, including kernel objects, drivers, and system tables, while omitting user-space application memory. It produces a smaller file, typically between a few hundred megabytes and several gigabytes.
3. Minidump: A small, truncated dump designed for crash debugging. It includes CPU registers, stack traces, and limited kernel structures, but lacks the memory ranges needed for deep forensic investigation.

### Acquiring memory dumps

Common tools used to capture live memory:

* FTK Imager: A GUI-based forensic tool capable of capturing raw RAM on live Windows hosts.
* DumpIt: A lightweight, portable command-line tool for capturing Windows physical memory.
* WinPmem: Part of the Rekall project, acquiring Windows physical memory via a kernel driver.
* LiME (Linux Memory Extractor): A loadable kernel module for acquiring raw physical memory on Linux systems.

Each acquisition tool runs with administrative or root privileges and should be launched from external, trusted media to minimize changes to volatile state.

## Inside a memory dump: structure, storage, and representation

### How a memory dump looks to the computer

To the operating system, physical RAM is a contiguous address space of bytes. Every machine instruction, global variable, network packet, and graphical pixel resides somewhere inside physical page frames.

When an acquisition tool runs, it reads physical memory sequentially or page by page through direct kernel mapping (such as `\Device\PhysicalMemory`) or driver interfaces, writing the raw byte stream to a file.

From the system's perspective:

* It is a linear range of physical addresses: `0x00000000` to `0xFFFFFFFF` on 32-bit systems, or `0x0000000000000000` to `0xFFFFFFFFFFFFFFFF` on 64-bit systems.
* Memory is managed in pages, usually 4 KB in size, dumped in physical or virtual order depending on the acquisition tool.
* The dump file contains no file system tables, folders, or directory trees. It is pure binary data representing physical memory cells.

### How it appears to us: analyst view

When we open a raw dump in a hex editor (such as HxD, WinHex, or 010 Editor), it displays as unformatted hexadecimal bytes:

```text
00000000  4D 5A 90 00 03 00 00 00 04 00 00 00 FF FF 00 00  MZ..............
00000010  B8 00 00 00 00 00 00 00 40 00 00 00 00 00 00 00  ........@.......
```

Here, `4D 5A` corresponds to the ASCII signature `MZ`, identifying the DOS header of a Windows executable mapped into RAM.
Across the rest of the image, we can find fragments of:

* PE headers (`MZ`, `PE\0\0`)
* Text strings from user chat sessions, logs, or command prompts
* Web pages, JSON objects, and cookies from browser heap buffers
* Network socket buffers and TCP control blocks
* Kernel objects and page tables
* Thread execution stacks

Frameworks like Volatility read these raw bytes and reconstruct logical structures: process trees, network sockets, file handles, and registry keys.

### Where memory dumps are stored

By default, memory dumps exist as flat binary files on disk. Common storage conventions include:

* Windows crash dumps: `C:\Windows\MEMORY.DMP` (full or kernel dump on blue screen) or `%SystemRoot%\Minidump\*.dmp` (minidumps).
* Forensic acquisitions: Saved to an analyst-designated external drive, such as `E:\evidence\case001\memdump.raw`.

Standard extensions in memory investigations:

* `.raw`: Pure binary dump containing unformatted physical pages
* `.dmp`: Windows crash dump format with crash headers
* `.vmem`: VMware virtual machine memory snapshot
* `.lime`: Memory image generated by the Linux Memory Extractor

The file size matches installed RAM unless compression or selective capture was applied.

### Compression and storage optimization

Physical memory captures can be substantial; a 32 GB system creates a 32 GB `.raw` file. To manage storage:

* Acquisition tools such as LiME or WinPmem support on-the-fly compression, producing `.raw.lime` or `.raw.gz` files.
* Compression algorithms are lossless, preserving byte accuracy.
* Volatility performs direct random access across memory layers, so it requires uncompressed dumps. Compressed images must be decompressed before running plugins.

Some acquisition formats also record page state flags in custom headers, distinguishing allocated pages from unmapped space.

### Internal structure of a memory dump

A physical memory capture typically contains:

* Optional container header: Stores metadata like capture timestamps, OS version, or memory ranges depending on the acquisition tool.
* Physical page frames: Standard 4 KB memory chunks holding system and application data.
* Paged-out references: Pointers to pages swapped to `pagefile.sys`.
* Optional integrity footer: Contains hashes or verification records confirming acquisition validity.

Because there is no file system metadata in physical memory, analysis tools navigate by following memory pointers, page tables, and known kernel object signatures.

## Part 2: Introduction to Volatility 3

### What is Volatility?

Volatility is an open-source memory forensics framework written in Python. It is the primary tool used by digital forensics and incident response (DFIR) teams to parse memory dumps across Windows, Linux, and macOS platforms.

### Volatility 2 vs Volatility 3: what changed?

Volatility 2 (Legacy):
* Depended on static, pre-defined OS profiles (such as `--profile=Win7SP1x64`).
* Required rebuilding profiles whenever operating system updates shifted kernel offsets.
* Used separate plugin implementations for different operating systems.

Volatility 3 (Modern):
* Uses dynamic symbol tables in Intermediate Symbol Format (ISF) JSON, generated directly from debug symbols (Microsoft PDBs).
* Automatically detects kernel structures without requiring manual profile flags.
* Features unified plugin namespaces and faster execution.

### Installation

```bash
# Install via pip
pip3 install volatility3

# Or clone from GitHub
git clone https://github.com/volatilityfoundation/volatility3.git
cd volatility3
pip install -r requirements.txt
python3 setup.py install

# Verify installation
vol -h
```

### Architecture overview

Volatility 3 splits processing across four main components:

* Framework core: Coordinates memory translation layers and resolves symbols.
* Memory layers: Translate virtual addresses to physical offsets using CPU paging structures (like the Directory Table Base in `CR3`).
* Symbol tables: JSON files describing structure sizes, field types, and member offsets for kernel types like `_EPROCESS` or `_FILE_OBJECT`.
* Plugins: Analysis modules that query memory layers to extract specific forensic artifacts.

## Part 3: Essential Volatility 3 plugins

Here we examine the core Volatility 3 plugins used during a Windows investigation, exploring their internal kernel mechanics alongside real command outputs.

### 3.1 windows.info: OS identification

The `windows.info` plugin identifies the operating system version, kernel build, and hardware architecture of a Windows memory dump. It extracts:

* OS version, build number, and Service Pack level
* Architecture (x86 vs x64)
* Kernel base address and debugger blocks
* System capture timestamp
* Active symbol tables and translation offsets

This metadata tells Volatility which symbol table to load so that structure offsets match the exact Windows build.

Internally, `windows.info` scans physical RAM for Windows kernel structures:

1. Locating the KDBG (Kernel Debugger Data Block): The KDBG is a global structure used by the Windows kernel debugger that contains references to core kernel lists. Volatility scans physical memory for KDBG signatures, verifying pointers to ensure structural validity. The KDBG exposes the build number, kernel base address, processor architecture, and system time (`KeSystemTime`).
2. Extracting the DTB (Directory Table Base): The DTB value (loaded into the CPU `CR3` register) holds the physical address of the Page Directory (x86) or Page Map Level 4 table (x64). It governs how virtual memory translates to physical page frames. Volatility reads the DTB from the KDBG or from the `_EPROCESS` structure of the `System` process, enabling subsequent plugins to resolve virtual memory addresses.
3. Matching symbol tables: With kernel identifiers confirmed, Volatility loads the matching Intermediate Symbol Format (ISF) JSON file for `ntkrnlmp.pdb`.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.info
```

Output:

```text
Variable        Value

Kernel Base     0xf80002609000
DTB     0x187000
Symbols file:///C:/Users/dasad/AppData/Local/Programs/Python/Python312/Lib/site-packages/volatility3/symbols/windows/ntkrnlmp.pdb/3844DBB920174967BE7AA4A2C20430FA-2.json.xz
Is64Bit True
IsPAE   False
layer_name      0 WindowsIntel32e
memory_layer    1 FileLayer
KdDebuggerDataBlock     0xf800027fa0a0
NTBuildLab      7601.17514.amd64fre.win7sp1_rtm.
CSDVersion      1
KdVersionBlock  0xf800027fa068
Major/Minor     15.7601
MachineType     34404
KeNumberProcessors      1
SystemTime      2019-08-19 14:41:58+00:00
NtSystemRoot    C:\Windows
NtProductType   NtProductWinNt
NtMajorVersion  6
NtMinorVersion  1
PE MajorOperatingSystemVersion  6
PE MinorOperatingSystemVersion  1
PE Machine      34404
PE TimeDateStamp        Sat Nov 20 09:30:02 2010
```

This output confirms that our image is a 64-bit Windows 7 SP1 capture (build 7601), single-processor, with its kernel base at `0xf80002609000`, using `ntkrnlmp.pdb` symbols, and captured at 2019-08-19 14:41:58 UTC.

### 3.2 windows.pslist: process listing

The `windows.pslist` plugin enumerates active processes at the time of the memory dump. It lists process identifiers, parent process IDs, thread counts, handle counts, session IDs, Wow64 status, and creation timestamps.

How it works under the hood:

* In the Windows kernel, each running process is represented by an `_EPROCESS` (Executive Process) structure in non-paged pool memory. This structure holds the process name (truncated to 15 characters in `ImageFileName`), PID, PPID, thread list head, handle table pointer, VAD root, and timestamps.
* All `_EPROCESS` blocks link together through the `ActiveProcessLinks` member, a circular doubly linked list (`LIST_ENTRY`) rooted at `PsActiveProcessHead`.
* Volatility traverses this list starting at the `System` process (PID 4), following forward pointers (`Flink`) to enumerate each process node.
* It parses the structure members using the offsets supplied by the loaded symbol table.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.pslist
```

Output:

```text
PID     PPID    ImageFileName   Offset(V)       Threads Handles SessionId       Wow64   CreateTime      ExitTime       File output

4       0       System  0xfa80012a5040  78      495     N/A     False   2019-08-19 14:40:07.000000 UTC  N/A     Disabled
264     4       smss.exe        0xfa8002971470  2       29      N/A     False   2019-08-19 14:40:07.000000 UTC  N/A    Disabled
336     328     csrss.exe       0xfa800234cb30  10      415     0       False   2019-08-19 14:40:10.000000 UTC  N/A    Disabled
384     328     wininit.exe     0xfa8002aae910  3       74      0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
396     376     csrss.exe       0xfa8002ab7060  9       499     1       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
436     376     winlogon.exe    0xfa8002b66560  6       116     1       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
480     384     services.exe    0xfa8002b99200  9       194     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
496     384     lsass.exe       0xfa8002bb4600  7       513     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
504     384     lsm.exe 0xfa80022ff910  10      152     0       False   2019-08-19 14:40:11.000000 UTC  N/A     Disabled
608     480     svchost.exe     0xfa8002ce8740  10      358     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
668     480     VBoxService.ex  0xfa8002d13060  13      136     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
724     480     svchost.exe     0xfa8002d4bb30  6       257     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
780     480     svchost.exe     0xfa8002d4fb30  19      405     0       False   2019-08-19 14:40:11.000000 UTC  N/A    Disabled
896     480     svchost.exe     0xfa8002dcf5f0  22      452     0       False   2019-08-19 14:40:12.000000 UTC  N/A    Disabled
948     480     svchost.exe     0xfa8002de1b30  35      893     0       False   2019-08-19 14:40:12.000000 UTC  N/A    Disabled
1008    780     audiodg.exe     0xfa8002e0b1c0  7       132     0       False   2019-08-19 14:40:12.000000 UTC  N/A    Disabled
400     480     svchost.exe     0xfa8002e645f0  13      275     0       False   2019-08-19 14:40:12.000000 UTC  N/A    Disabled
1052    480     svchost.exe     0xfa8002eac740  17      368     0       False   2019-08-19 14:40:12.000000 UTC  N/A    Disabled
1176    480     spoolsv.exe     0xfa8002e76b30  14      279     0       False   2019-08-19 14:40:13.000000 UTC  N/A    Disabled
1212    480     svchost.exe     0xfa8002f4d780  21      311     0       False   2019-08-19 14:40:13.000000 UTC  N/A    Disabled
1308    480     svchost.exe     0xfa8002f79b30  17      253     0       False   2019-08-19 14:40:13.000000 UTC  N/A    Disabled
1812    480     taskhost.exe    0xfa8003144250  9       147     1       False   2019-08-19 14:40:18.000000 UTC  N/A    Disabled
1868    896     dwm.exe 0xfa8003160120  4       70      1       False   2019-08-19 14:40:18.000000 UTC  N/A     Disabled
1876    948     taskeng.exe     0xfa8003164b30  5       81      0       False   2019-08-19 14:40:18.000000 UTC  N/A    Disabled
1944    1844    explorer.exe    0xfa800319a060  35      894     1       False   2019-08-19 14:40:19.000000 UTC  N/A    Disabled
1292    1928    GoogleCrashHan  0xfa8003227060  7       105     0       True    2019-08-19 14:40:19.000000 UTC  N/A    Disabled
924     1928    GoogleCrashHan  0xfa8003219060  6       93      0       False   2019-08-19 14:40:19.000000 UTC  N/A    Disabled
1108    1944    VBoxTray.exe    0xfa8003277810  14      139     1       False   2019-08-19 14:40:20.000000 UTC  N/A    Disabled
880     1944    cmd.exe 0xfa8002324b30  1       21      1       False   2019-08-19 14:40:26.000000 UTC  N/A     Disabled
916     396     conhost.exe     0xfa800231e370  3       50      1       False   2019-08-19 14:40:26.000000 UTC  N/A    Disabled
856     480     SearchIndexer.  0xfa8003315060  13      689     0       False   2019-08-19 14:40:27.000000 UTC  N/A    Disabled
2124    1944    chrome.exe      0xfa800234eb30  27      662     1       False   2019-08-19 14:40:46.000000 UTC  N/A    Disabled
2132    2124    chrome.exe      0xfa800234f780  9       75      1       False   2019-08-19 14:40:46.000000 UTC  N/A    Disabled
2168    2124    chrome.exe      0xfa800314fab0  3       55      1       False   2019-08-19 14:40:49.000000 UTC  N/A    Disabled
2292    608     WmiPrvSE.exe    0xfa80032d9060  13      288     0       False   2019-08-19 14:40:52.000000 UTC  N/A    Disabled
2340    2124    chrome.exe      0xfa80032f9a70  12      282     1       False   2019-08-19 14:40:52.000000 UTC  N/A    Disabled
2440    2124    chrome.exe      0xfa8003741b30  13      263     1       False   2019-08-19 14:40:54.000000 UTC  N/A    Disabled
2452    2124    chrome.exe      0xfa800374bb30  14      167     1       False   2019-08-19 14:40:54.000000 UTC  N/A    Disabled
2800    480     WmiApSrv.exe    0xfa8002b74060  6       115     0       False   2019-08-19 14:40:57.000000 UTC  N/A    Disabled
2896    608     WmiPrvSE.exe    0xfa8002d9eab0  7       124     0       False   2019-08-19 14:40:57.000000 UTC  N/A    Disabled
2940    2124    chrome.exe      0xfa80032d4380  9       172     1       False   2019-08-19 14:41:06.000000 UTC  N/A    Disabled
2080    3060    firefox.exe     0xfa8003905b30  59      970     1       True    2019-08-19 14:41:08.000000 UTC  N/A    Disabled
2860    2080    firefox.exe     0xfa80021fa630  11      210     1       True    2019-08-19 14:41:09.000000 UTC  N/A    Disabled
3016    2080    firefox.exe     0xfa80013a4580  31      413     1       True    2019-08-19 14:41:10.000000 UTC  N/A    Disabled
2968    2080    firefox.exe     0xfa8001415b30  22      323     1       True    2019-08-19 14:41:11.000000 UTC  N/A    Disabled
3316    2080    firefox.exe     0xfa8001454b30  21      307     1       True    2019-08-19 14:41:13.000000 UTC  N/A    Disabled
3716    1944    WinRAR.exe      0xfa80035e71e0  7       201     1       False   2019-08-19 14:41:43.000000 UTC  N/A    Disabled
4084    1944    DumpIt.exe      0xfa800156e400  5       46      1       True    2019-08-19 14:41:55.000000 UTC  N/A    Disabled
4092    396     conhost.exe     0xfa80014c1060  2       50      1       False   2019-08-19 14:41:55.000000 UTC  N/A    Disabled
1224    480     sppsvc.exe      0xfa80014aa060  5       0       0       False   2019-08-19 14:42:39.000000 UTC  N/A    Disabled
2256    2396    GoogleUpdate.e  0xfa800157eb30  3       118     0       True    2019-08-19 14:42:40.000000 UTC  N/A    Disabled
1192    2256    GoogleCrashHan  0xfa80014f9060  3       46      0       True    2019-08-19 14:42:41.000000 UTC  N/A    Disabled
864     2256    GoogleCrashHan  0xfa80035e3700  1       1279459345      0       False   2019-08-19 14:42:41.000000 UTC N/A      Disabled
```

Observations from the process list:

* Core startup hierarchy: `System` (PID 4) anchors the kernel. Processes like `smss.exe`, `csrss.exe`, and `services.exe` (PID 480) match legitimate Windows initialization.
* Service groups: Multiple `svchost.exe` instances run with varying thread counts, each hosting different service groups. Background utilities like `taskhost.exe`, `spoolsv.exe`, and `WmiPrvSE.exe` reflect standard background components.
* User-facing software: Applications like `chrome.exe`, `firefox.exe`, `WinRAR.exe`, and `DumpIt.exe` reflect interactive user activity. Multi-process browser architectures produce multiple child renderer and utility workers.
* Architecture flags: The `Wow64` column identifies 32-bit processes executing under the Windows 64-bit emulator. For example, `firefox.exe` and `DumpIt.exe` show `Wow64=True`.
* Process state: An `ExitTime` of `N/A` indicates the process was actively running when memory was dumped.
* Cross-referencing: The virtual memory offsets (`Offset(V)`) and PIDs allow us to target specific processes with deeper plugins like `cmdline`, `envars`, or `dumpfiles`.

### 3.3 windows.pstree: process tree analysis

The `windows.pstree` plugin constructs a parent-child execution tree by correlating process IDs with parent process IDs. It reveals process ancestry, highlighting abnormal spawning relationships such as command shells launched by services, or processes masquerading under unexpected parents.

How `pstree` maps relationships:

1. It reads `_EPROCESS` structures from memory to obtain each process's `UniqueProcessId` (PID) and `InheritedFromUniqueProcessId` (PPID).
2. It links child processes to their parent nodes, constructing an indented hierarchy.
3. It notes anomalies, such as processes whose parent PID no longer exists in memory (common in process hollowing or when launcher scripts terminate immediately).

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.pstree
```

Output:

```text
PID     PPID    ImageFileName   Offset(V)       Threads Handles SessionId       Wow64   CreateTime      ExitTime

4       0       System  0xfa80012a5040  78      495     N/A     False   2019-08-19 14:40:07.000000 UTC  N/A
. 264   4       smss.exe        0xfa8002971470  2       29      N/A     False   2019-08-19 14:40:07.000000 UTC  N/A
...
. 480   384     services.exe    0xfa8002b99200  9       194     0       False   2019-08-19 14:40:11.000000 UTC  N/A
.. 608  480     svchost.exe     0xfa8002ce8740  10      358     0       False   2019-08-19 14:40:11.000000 UTC  N/A
.. 724  480     svchost.exe     0xfa8002d4bb30  6       257     0       False   2019-08-19 14:40:11.000000 UTC  N/A
. 1944  1844    explorer.exe    0xfa800319a060  35      894     1       False   2019-08-19 14:40:19.000000 UTC  N/A
.. 880  1944    cmd.exe 0xfa8002324b30  1       21      1       False   2019-08-19 14:40:26.000000 UTC  N/A
.. 2124 1944    chrome.exe      0xfa800234eb30  27      662     1       False   2019-08-19 14:40:46.000000 UTC  N/A
... 2132 2124   chrome.exe      0xfa800234f780  9       75      1       False   2019-08-19 14:40:46.000000 UTC  N/A
.. 3716 1944    WinRAR.exe      0xfa80035e71e0  7       201     1       False   2019-08-19 14:41:43.000000 UTC  N/A
.. 4084 1944    DumpIt.exe      0xfa800156e400  5       46      1       True    2019-08-19 14:41:55.000000 UTC  N/A
```

Key takeaways from the process tree:

* `cmd.exe` and `DumpIt.exe` running under `explorer.exe` (PID 1944) confirm interactive execution by the logged-in user.
* `chrome.exe` (PID 2124) spawns child renderer processes, matching standard sandboxed browser architecture.
* Both `firefox.exe` and `chrome.exe` run simultaneously, suggesting the user maintained separate browsing sessions.
* `VBoxService.exe` and `VBoxTray.exe` show the operating system was hosted in a VirtualBox virtual machine.

### 3.4 windows.cmdline: command line arguments

The `windows.cmdline` plugin recovers the full command-line strings used to start each process. While `pslist` truncates process names to 15 characters and excludes arguments, `cmdline` retrieves the complete invocation strings, including file paths, parameters, and flags.

How it works:

* Volatility locates `_EPROCESS` in kernel memory and follows the pointer to the Process Environment Block (PEB) located in user-mode address space.
* Inside the PEB, `ProcessParameters` points to the `_RTL_USER_PROCESS_PARAMETERS` structure.
* This structure stores `CommandLine` as a `UNICODE_STRING` (specifying length and buffer address). Volatility reads the buffer directly from process memory.
* The extracted string is decoded from UTF-16. If the buffer is unmapped or paged out, it displays as `-`.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.cmdline
```

Output:

```text
PID     Process          Args
4       System           -
264     smss.exe         \SystemRoot\System32\smss.exe
336     csrss.exe        %SystemRoot%\system32\csrss.exe ObjectDirectory=\Windows SharedSection=1024,20480,768 Windows=On SubSystemType=Windows ServerDll=basesrv,1 ServerDll=winsrv:UserServerDllInitialization,3 ServerDll=winsrv:ConServerDllInitialization,2 ServerDll=sxssrv,4 ProfileControl=Off MaxRequestThreads=16
384     wininit.exe      wininit.exe
396     csrss.exe        %SystemRoot%\system32\csrss.exe ObjectDirectory=\Windows SharedSection=1024,20480,768 Windows=On SubSystemType=Windows ServerDll=basesrv,1 ServerDll=winsrv:UserServerDllInitialization,3 ServerDll=winsrv:ConServerDllInitialization,2 ServerDll=sxssrv,4 ProfileControl=Off MaxRequestThreads=16
436     winlogon.exe     winlogon.exe
480     services.exe     C:\Windows\system32\services.exe
496     lsass.exe        C:\Windows\system32\lsass.exe
504     lsm.exe          C:\Windows\system32\lsm.exe
608     svchost.exe      C:\Windows\system32\svchost.exe -k DcomLaunch
668     VBoxService.exe  C:\Windows\System32\VBoxService.exe
724     svchost.exe      C:\Windows\system32\svchost.exe -k RPCSS
780     svchost.exe      C:\Windows\System32\svchost.exe -k LocalServiceNetworkRestricted
896     svchost.exe      C:\Windows\System32\svchost.exe -k LocalSystemNetworkRestricted
948     svchost.exe      C:\Windows\system32\svchost.exe -k netsvcs
1008    audiodg.exe      C:\Windows\system32\AUDIODG.EXE 0x2ac
400     svchost.exe      C:\Windows\system32\svchost.exe -k LocalService
1052    svchost.exe      C:\Windows\system32\svchost.exe -k NetworkService
1176    spoolsv.exe      C:\Windows\System32\spoolsv.exe
1212    svchost.exe      C:\Windows\system32\svchost.exe -k LocalServiceNoNetwork
1308    svchost.exe      C:\Windows\system32\svchost.exe -k LocalServiceAndNoImpersonation
1812    taskhost.exe     "taskhost.exe"
1868    dwm.exe          "C:\Windows\system32\Dwm.exe"
1876    taskeng.exe      taskeng.exe {54DBC692-AE6C-4620-B58A-A05704950172}
1944    explorer.exe     C:\Windows\Explorer.EXE
1292    GoogleCrashHan   "C:\Program Files (x86)\Google\Update\1.3.34.11\GoogleCrashHandler.exe"
924     GoogleCrashHan   "C:\Program Files (x86)\Google\Update\1.3.34.11\GoogleCrashHandler64.exe"
1108    VBoxTray.exe     "C:\Windows\System32\VBoxTray.exe"
880     cmd.exe          "C:\Windows\system32\cmd.exe"
916     conhost.exe      \??\C:\Windows\system32\conhost.exe
856     SearchIndexer.exe C:\Windows\system32\SearchIndexer.exe /Embedding
2124    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
2132    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=crashpad-handler "--user-data-dir=C:\Users\Jaffa\AppData\Local\Google\Chrome\User Data" /prefetch:7 --monitor-self-annotation=ptype=crashpad-handler "--database=C:\Users\Jaffa\AppData\Local\Google\Chrome\User Data\Crashpad" "--metrics-dir=C:\Users\Jaffa\AppData\Local\Google\Chrome\User Data" --url=https://clients2.google.com/cr/report --annotation=channel= --annotation=plat=Win64 --annotation=prod=Chrome --annotation=ver=76.0.3809.100 --initial-client-data=0x38,0x3c,0x40,0x34,0x44,0x7fef693ef08,0x7fef693ef18,0x7fef693ef28
2168    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=watcher --main-thread-id=2128 --on-initialized-event-handle=12 --parent-handle=164 /prefetch:6
2292    WmiPrvSE.exe     C:\Windows\system32\wbem\wmiprvse.exe
2340    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=utility --field-trial-handle=912,6904440883533218926,14009848578096020689,131072 --lang=en-US --service-sandbox-type=network --service-request-channel-token=7087325372642059998 --mojo-platform-channel-handle=1404 /prefetch:8
2440    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=renderer --field-trial-handle=912,6904440883533218926,14009848578096020689,131072 --lang=en-US --instant-process --enable-auto-reload --device-scale-factor=1 --num-raster-threads=1 --service-request-channel-token=30920957510107878 --renderer-client-id=6 --no-v8-untrusted-code-mitigations --mojo-platform-channel-handle=1956 /prefetch:1
2452    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=renderer --field-trial-handle=912,6904440883533218926,14009848578096020689,131072 --lang=en-US --enable-auto-reload --device-scale-factor=1 --num-raster-threads=1 --service-request-channel-token=8732891429699623721 --renderer-client-id=7 --no-v8-untrusted-code-mitigations --mojo-platform-channel-handle=2148 /prefetch:1
2800    WmiApSrv.exe     C:\Windows\system32\wbem\WmiApSrv.exe
2896    WmiPrvSE.exe     C:\Windows\system32\wbem\wmiprvse.exe
2940    chrome.exe       "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --type=gpu-process --field-trial-handle=912,6904440883533218926,14009848578096020689,131072 --gpu-preferences=IAAAAAAAAADgAAAwAAAAAAAAYAAAAAAACAAAAAAAAAAoAAAABAAAACAAAAAAAAAAKAAAAAAAAAAwAAAAAAAAADgAAAAAAAAAEAAAAAAAAAAAAAAABQAAABAAAAAAAAAAAAAAAAYAAAAQAAAAAAAAAAEAAAAFAAAAEAAAAAAAAAABAAAABgAAAA== --use-gl=swiftshader-webgl --service-request-channel-token=8183290027954516201 --mojo-platform-channel-handle=2724 --ignored=" --type=renderer " /prefetch:2
2080    firefox.exe      "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
2860    firefox.exe      "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" -contentproc --channel="2080.0.1430399655\1507561340" -parentBuildID 20190813150448 -greomni "C:\Program Files (x86)\Mozilla Firefox\omni.ja" -appomni "C:\Program Files (x86)\Mozilla Firefox\browser\omni.ja" -appdir "C:\Program Files (x86)\Mozilla Firefox\browser" - 2080 "\\.\pipe\gecko-crash-server-pipe.2080" 1096 gpu
3016    firefox.exe      "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" -contentproc --channel="2080.3.1961766982\1524136179" -childID 1 -isForBrowser -prefsHandle 1596 -prefMapHandle 1652 -prefsLen 1 -prefMapSize 190550 -parentBuildID 20190813150448 -greomni "C:\Program Files (x86)\Mozilla Firefox\omni.ja" -appomni "C:\Program Files (x86)\Mozilla Firefox\browser\omni.ja" -appdir "C:\Program Files (x86)\Mozilla Firefox\browser" - 2080 "\\.\pipe\gecko-crash-server-pipe.2080" 764 tab
2968    firefox.exe      "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" -contentproc --channel="2080.13.820371489\1898621292" -childID 2 -isForBrowser -prefsHandle 2684 -prefMapHandle 2688 -prefsLen 5982 -prefMapSize 190550 -parentBuildID 20190813150448 -greomni "C:\Program Files (x86)\Mozilla Firefox\omni.ja" -appomni "C:\Program Files (x86)\Mozilla Firefox\browser\omni.ja" -appdir "C:\Program Files (x86)\Mozilla Firefox\browser" - 2080 "\\.\pipe\gecko-crash-server-pipe.2080" 2700 tab
3316    firefox.exe      "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" -contentproc --channel="2080.20.122820616\259359170" -childID 3 -isForBrowser -prefsHandle 3252 -prefMapHandle 3728 -prefsLen 6704 -prefMapSize 190550 -parentBuildID 20190813150448 -greomni "C:\Program Files (x86)\Mozilla Firefox\omni.ja" -appomni "C:\Program Files (x86)\Mozilla Firefox\browser\omni.ja" -appdir "C:\Program Files (x86)\Mozilla Firefox\browser" - 2080 "\\.\pipe\gecko-crash-server-pipe.2080" 3740 tab
3716    WinRAR.exe       "C:\Program Files\WinRAR\WinRAR.exe" "C:\Users\Jaffa\Desktop\pr0t3ct3d\flag.rar"
4084    DumpIt.exe       "C:\Users\Jaffa\Desktop\DumpIt.exe"
4092    conhost.exe      \??\C:\Windows\system32\conhost.exe
1224    sppsvc.exe       -
2256    GoogleUpdate.e   -
1192    GoogleCrashHan   -
864     GoogleCrashHan   -
```

Notable artifacts:

* Startup processes (`smss.exe`, `csrss.exe`) show typical session parameters (`SharedSection`, `SubSystemType`).
* Service hosts show their modular service groups via `-k` parameters (`-k DcomLaunch`, `-k RPCSS`, `-k netsvcs`).
* Browser processes show internal IPC endpoints and worker types (`--type=renderer`, `--type=gpu-process`).
* `WinRAR.exe` (PID 3716) was launched with `"C:\Users\Jaffa\Desktop\pr0t3ct3d\flag.rar"`, revealing the exact path to an encrypted evidence archive.
* `DumpIt.exe` was executed from user `Jaffa`'s desktop.

### 3.5 windows.filescan: file object scan

The `windows.filescan` plugin searches kernel memory for `_FILE_OBJECT` allocations. It identifies:

* Files open during memory acquisition
* Temporary files and active browser cache files
* Unmapped or closed files that remain cached in kernel pool memory

Because `filescan` inspects pool tags rather than active handle tables, it finds files even if their user handles have been closed.

Under the hood:

* The Windows I/O manager creates a `_FILE_OBJECT` structure whenever a file handle is opened.
* Key fields include `FileName` (a `UNICODE_STRING` holding the file path), `DeviceObject`, `Vpb` (Volume Parameter Block), and `SectionObjectPointer` (cache control).
* Volatility scans physical memory pages for pool tags matching file allocations and prints the virtual offset alongside the file path.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.filescan
```

Output (truncated):

```text
Offset         Name
0x53f2690      \Endpoint
0x53f2800      \chrome.2968.1.28264847
0x53f3770      \Users\Jaffa\AppData\Local\Mozilla\Firefox\Profiles\84kisw0a.default-release\cache2\entries\F3A2A55211EE66D36F43F15EFF501E9546680661
0x53f4430      \Users\Jaffa\AppData\Local\Mozilla\Firefox\Profiles\84kisw0a.default-release\cache2\entries\3168C61F89D068684E314E0668C083341C5929A8
0x53f47e0      \Users\Jaffa\AppData\Local\Mozilla\Firefox\Profiles\84kisw0a.default-release\cache2\entries\32027373AB514902694BD2F13A8E08513EAF1DF9
0x53f5180      \chrome.2968.2.15970394
0x53f59e0      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\webappsstore.sqlite-wal
0x53f5d00      \chrome.2968.1.28264847
0x53f5f20      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\favicons.sqlite
0x53f65f0      \Endpoint
0x53f6f20      \chrome.2968.0.66569659
0x53f7070      \Windows\SysWOW64\actxprxy.dll
0x53f7760      \Endpoint
0x53f7cb0      \Users\Jaffa\AppData\Local\Mozilla\Firefox\Profiles\84kisw0a.default-release\cache2\entries\3695979DC4CDB6256489DC66C1152B1985B55252
0x53f7f20      \chrome.3016.3.194647336
0x53f8070      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\storage\permanent\chrome\idb\1657114595AmcateirvtiSty.sqlite
0x53f89e0      \$Directory
0x53f8d10      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\webappsstore.sqlite
0x53f9070      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\storage\default\https+++mail.google.com\cache\morgue\75\{f4ec0805-5e72-4cbe-a262-5a99a7abb04b}.tmp
0x53f94a0      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\webappsstore.sqlite-shm
0x53f9680      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\favicons.sqlite-wal
0x53f9890      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\webappsstore.sqlite-wal
0x53f9c80      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\favicons.sqlite-wal
0x53fa630      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\storage\permanent\chrome\idb\3561288849sdhlie.sqlite
0x53fac80      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\favicons.sqlite-shm
0x53faf20      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\content-prefs.sqlite
0x53fb2d0      \Windows\System32\samlib.dll
0x53fcbd0      \Windows\System32\dui70.dll
0x53fd070      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\places.sqlite
0x53fdb30      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\places.sqlite-wal
0x53fde20      \Users\Jaffa\AppData\Roaming\Mozilla\Firefox\Profiles\84kisw0a.default-release\storage\default\https+++mail.google.com\cache\morgue\63\{401978b9-d8ee-4339-8725-fcdb3224fd3f}.final
0x53fe830      \Users\Jaffa\AppData\Local\Microsoft\Windows\Explorer\thumbcache_256.db
```

Observations:

* Browser databases: Firefox storage entries (`places.sqlite`, `favicons.sqlite`, `webappsstore.sqlite`) record browsing history and cached data.
* Webmail caching: Files like `https+++mail.google.com\cache\morgue\...` confirm active Gmail sessions in Firefox.
* Explorer caching: `thumbcache_256.db` stores image thumbnails, providing leads on recently viewed graphics.

### 3.6 windows.dumpfiles: file extraction from memory

The `windows.dumpfiles` plugin extracts the actual file contents associated with an in-memory `_FILE_OBJECT` structure.

Under the hood:

* Volatility reads the `_FILE_OBJECT` at the target virtual offset and follows its `SectionObjectPointer` member.
* This pointer leads to `_CONTROL_AREA` and `_SEGMENT` structures maintained by the Windows cache manager.
* These control structures identify the physical memory pages where the file contents are cached.
* Volatility dumps those page frames to disk, reconstructing the file.

Command:

```bash
vol -f MemoryDump_Lab6.raw -o ./dumpfiles windows.dumpfiles --virtaddr 0x5fcfc4b0
```

This dumps the file cached at offset `0x5fcfc4b0` (`\Users\Jaffa\Desktop\flag.rar`) directly to the `./dumpfiles` directory.

### 3.7 windows.envars: environment variables extraction

The `windows.envars` plugin parses environment variables for each running process from user-mode memory. This reveals system configuration paths, user directories, and sensitive values (such as API keys, tokens, or passwords) stored in process memory.

How it works:

1. Volatility resolves `_EPROCESS` for each process in kernel space.
2. It follows `_EPROCESS.Peb` into user-mode address space, reaching `_RTL_USER_PROCESS_PARAMETERS`.
3. It accesses the `Environment` pointer, which references a continuous block of null-terminated UTF-16 strings formatted as `KEY=VALUE`.
4. It decodes the environment block into readable output.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.envars
```

Output (truncated):

```text
PID     Process          Offset      Variable Name           Value

4084    DumpIt.exe       0x4e1dc0    ProgramFiles(x86)       C:\Program Files (x86)
4084    DumpIt.exe       0x4e1dc0    ProgramW6432            C:\Program Files
4084    DumpIt.exe       0x4e1dc0    PSModulePath            C:\Windows\system32\WindowsPowerShell\v1.0\Modules\
4084    DumpIt.exe       0x4e1dc0    RAR password            easypeasyvirus
4084    DumpIt.exe       0x4e1dc0    TEMP                    C:\Users\Jaffa\AppData\Local\Temp
4084    DumpIt.exe       0x4e1dc0    USERNAME                Jaffa
4084    DumpIt.exe       0x4e1dc0    USERPROFILE             C:\Users\Jaffa
4092    conhost.exe      0x2d1900    OS                      Windows_NT
4092    conhost.exe      0x2d1900    Path                    C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0\
4092    conhost.exe      0x2d1900    PROCESSOR_ARCHITECTURE  AMD64
4092    conhost.exe      0x2d1900    PROCESSOR_IDENTIFIER    Intel64 Family 6 Model 158 Stepping 10, GenuineIntel
```

Observations:

* User and system paths: `USERNAME`, `USERPROFILE`, `TEMP`, and `Path` establish the context of user `Jaffa`.
* Stored credentials: The environment block of `DumpIt.exe` contains `RAR password=easypeasyvirus`. Because child processes inherit parent environment variables by default, sensitive credentials set in a terminal session frequently persist across subsequent commands.

### 3.8 windows.netscan: network connections extraction

The `windows.netscan` plugin recovers active, listening, and recently terminated TCP and UDP connections from memory.

Under the hood:

* It scans kernel pool allocations for TCP/IP protocol control blocks: `_TCP_ENDPOINT` and `_UDP_ENDPOINT` structures allocated by `tcpip.sys`.
* It extracts local addresses, local ports, remote addresses, remote ports, connection states (`ESTABLISHED`, `LISTENING`, `TIME_WAIT`), and links each endpoint back to its owning `_EPROCESS` object.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.netscan
```

Output:

```text
Offset       Proto    LocalAddr       LocalPort    ForeignAddr          ForeignPort    State          PID    Owner            Created
0x53f2010    TCPv4    127.0.0.1       49171       127.0.0.1            49170          ESTABLISHED    2968   firefox.exe       N/A
0x53f2a90    TCPv4    127.0.0.1       49170       127.0.0.1            49171          ESTABLISHED    2968   firefox.exe       N/A
0x5d80d9f0   UDPv4    127.0.0.1       58500       *                    0              1308           svchost.exe       2019-08-19 14:42:39.000000 UTC
0x5d8c3360   UDPv4    0.0.0.0         5353        *                    0              2124           chrome.exe        2019-08-19 14:40:55.000000 UTC
0x5d8c3360   UDPv6    ::              5353        *                    0              2124           chrome.exe        2019-08-19 14:40:55.000000 UTC
0x5d8c3ec0   UDPv4    0.0.0.0         5353        *                    0              2124           chrome.exe        2019-08-19 14:40:55.000000 UTC
0x5d8d8500   TCPv4    10.0.2.15       49232       172.217.160.131      80             ESTABLISHED    2080   firefox.exe       N/A
0x5d8e7b90   TCPv4    127.0.0.1       49166       127.0.0.1            49165          ESTABLISHED    2080   firefox.exe       N/A
0x5d8e9010   TCPv4    10.0.2.15       49235       172.217.194.189      443            ESTABLISHED    2080   firefox.exe       N/A
0x5d9705f0   TCPv4    10.0.2.15       49196       172.217.160.133      443            ESTABLISHED    2080   firefox.exe       N/A
0x5dadd860   TCPv4    10.0.2.15       49198       216.58.197.67        443            ESTABLISHED    2080   firefox.exe       N/A
0x5daeb850   TCPv4    127.0.0.1       49165       127.0.0.1            49166          ESTABLISHED    2080   firefox.exe       N/A
0x5dafccf0   TCPv4    10.0.2.15       49224       172.217.163.205      443            ESTABLISHED    2080   firefox.exe       N/A
0x5dde8680   TCPv4    10.0.2.15       49234       172.217.163.106      443            ESTABLISHED    2080   firefox.exe       N/A
0x5ddf9010   TCPv4    10.0.2.15       49202       216.58.196.163       443            ESTABLISHED    2080   firefox.exe       N/A
0x5de48b50   TCPv4    0.0.0.0         49156       0.0.0.0              0              LISTENING       496   lsass.exe         -
0x5e0663e0   TCPv4    0.0.0.0         5357        0.0.0.0              0              LISTENING       4     System            -
0x5e0663e0   TCPv6    ::              5357        ::                   0              LISTENING       4     System            -
0x5e06b010   UDPv4    0.0.0.0         64930       *                    0              1308           svchost.exe       2019-08-19 14:40:13.000000 UTC
0x5e06b620   UDPv4    0.0.0.0         64931       *                    0              1308           svchost.exe       2019-08-19 14:40:13.000000 UTC
0x5e06b620   UDPv6    ::              64931       *                    0              1308           svchost.exe       2019-08-19 14:40:13.000000 UTC
...
0x5ff6b6d0   UDPv6    ::1             1900        *                    0              1308           svchost.exe       2019-08-19 14:42:39.000000 UTC
```

Observations:

* Loopback activity: Established TCP connections on `127.0.0.1` represent local inter-process communication between browser processes.
* External web sessions: Firefox maintains active TCP connections to external IP ranges (`172.217.x.x` and `216.58.x.x`) over HTTP (port 80) and HTTPS (port 443), corresponding to Google services.
* Listening endpoints: System services (`System`, `lsass.exe`, `svchost.exe`) listen on standard Windows RPC and service discovery ports.

### 3.9 windows.registry.hivelist: registry hive enumeration

The `windows.registry.hivelist` plugin identifies all registry hives mapped into kernel memory. Registry hives store configuration policies, user preferences, autostart programs, and credential references.

Under the hood:

* The plugin scans kernel memory for `_CMHIVE` structures representing open registry hives.
* It extracts the hive's virtual base address, path, and storage bin structure.
* The virtual offsets allow subsequent plugins (such as `windows.registry.printkey`) to read keys and values directly from memory.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.registry.hivelist
```

Output:

```text
Offset          FileFullPath                                                           File output
0xf8a00000d010  Disabled
0xf8a000024010  \REGISTRY\MACHINE\SYSTEM                                          Disabled
0xf8a00004e010  \REGISTRY\MACHINE\HARDWARE                                        Disabled
0xf8a0006d7010  \SystemRoot\System32\Config\SOFTWARE                               Disabled
0xf8a0009611f0  \SystemRoot\System32\Config\SECURITY                               Disabled
0xf8a0009bc410  \SystemRoot\System32\Config\SAM                                     Disabled
0xf8a000a9d410  \??\C:\Windows\ServiceProfiles\NetworkService\NTUSER.DAT            Disabled
0xf8a000b8e410  \??\C:\Windows\ServiceProfiles\LocalService\NTUSER.DAT              Disabled
0xf8a000df7010  \??\C:\Users\Jaffa\ntuser.dat                                      Disabled
0xf8a001023010  \??\C:\Users\Jaffa\AppData\Local\Microsoft\Windows\UsrClass.dat   Disabled
0xf8a003ca8010  \Device\HarddiskVolume1\Boot\BCD                                    Disabled
0xf8a005b63410  \SystemRoot\System32\Config\DEFAULT                                Disabled
```

Observations:

* System hives (`SYSTEM`, `SOFTWARE`, `SECURITY`, `SAM`) provide anchors for analyzing service configuration and account credentials.
* User hives (`C:\Users\Jaffa\ntuser.dat` and `UsrClass.dat`) provide targets for inspecting user activity, Shellbags, and run keys.
* Boot configuration is accessible via `BCD`.

### 3.10 windows.malware.malfind: spotting injected memory segments

The `windows.malware.malfind` plugin flags memory regions that exhibit characteristics of code injection or in-memory malware. It looks for committed, private memory pages marked with execute permissions that lack backing executable files on disk.

Under the hood:

* It traverses each process's Virtual Address Descriptor (VAD) tree, rooted at `_EPROCESS.VadRoot`.
* It identifies pages with `PAGE_EXECUTE_READWRITE` permissions that are not mapped from a file.
* It disassembles the leading bytes at the page base to expose shellcode stubs, indirect jumps, or unmapped PE headers.

Command:

```bash
vol -f MemoryDump_Lab6.raw windows.malware.malfind
```

Output:

```text
PID     Process       Start VPN   End VPN     Tag     Protection               CommitCharge    PrivateMemory  File output  Notes  Hexdump  Disasm
1944    explorer.exe  0x4320000   0x432ffff   VadS    PAGE_EXECUTE_READWRITE     16             1              Disabled     N/A    ...      ...
0x4320000:      mov     r10d, 0x80
0x4320006:      movabs  rax, 0x7feff86a138
0x4320010:      jmp     qword ptr [rax]
0x4320013:      nop
0x4320014:      mov     r10d, 0x81
0x432001a:      movabs  rax, 0x7feff86a138
0x4320024:      jmp     qword ptr [rax]
0x4320027:      nop
0x4320028:      mov     r10d, 0x82
0x432002e:      movabs  rax, 0x7feff86a138
0x4320038:      jmp     qword ptr [rax]
0x432003b:      nop
```

Observations:

* The memory segment inside `explorer.exe` (PID 1944) has `PAGE_EXECUTE_READWRITE` permissions, which is abnormal for standard process memory.
* The disassembly reveals a loop of `mov` and indirect `jmp` instructions, indicative of hook dispatchers or shellcode stubs.
* Because the page is private and committed without disk backing, it warrants investigation for memory injection.

## Putting it all together

Now that we have reviewed the core Volatility plugins and their underlying kernel mechanics, we can apply them directly to solve a real-world scenario. Check out our companion walkthrough of [MemLabs Lab 6: The Reckoning](/blogs/post.html?src=memlabs.md) to see how we use these plugins step by step to reconstruct an entire investigation, recover decryption keys, repair corrupted headers, and extract both flag fragments.

## References and further reading

* [Volatility 3 documentation](https://volatility3.readthedocs.io/en/latest/)
* [Volatility GitHub repository](https://github.com/volatilityfoundation/volatility3)
* [MemLabs CTF challenges](https://github.com/stuxnet999/MemLabs)
* [Volatility 3 plugin development guide](https://volatility3.readthedocs.io/en/latest/development.html)
* [Windows Internals](https://docs.microsoft.com/en-us/sysinternals/)
* [MemLabs Lab 6 walkthrough](/blogs/post.html?src=memlabs.md)
