# MemLabs Lab 6: The Reckoning

Lab 6 from Abhiram Kumar's MemLabs series is one of the more involved challenges in the set. We are given a raw physical memory dump taken from an associate of David Benjamin, and our goal is to recover a two-part flag in the `inctf{...}` format. The scenario notes that the suspect coordinated over the internet, which points our investigation toward browser history, external downloads, cached files, and active processes.

### Challenge details

File: `MemoryDump_Lab6.raw`
MD5: `405985dc8ab7651c65cdbc04cb22961c`
Format: `inctf{...}` (two parts combined)
Target architecture: Windows x64

## Identifying the OS profile

We start by identifying the kernel build and symbol requirements using `windows.info`:

```bash
vol -f MemoryDump_Lab6.raw windows.info
```

The dump comes from a 64-bit Windows 7 SP1 system (build 7601). Knowing the architecture up front is important because 64-bit Windows uses four-level PML4 paging for address translation, and kernel structure offsets for objects like `_EPROCESS` differ between 32-bit and 64-bit builds.

![os-info](https://hackmd.io/_uploads/B1RUrLXlWl.png)

## Process enumeration

Next, we run `windows.pslist` to see what was active on the system when memory was captured:

```bash
vol -f MemoryDump_Lab6.raw windows.pslist
```

```bash
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

A few processes jump out immediately:

* `chrome.exe` (PID 2124 spawning renderers and background utility workers)
* `firefox.exe` (PID 2080 with worker processes)
* `WinRAR.exe` (PID 3716)
* `cmd.exe` (PID 880)
* `DumpIt.exe` (PID 4084, the tool used to capture this memory dump)

Having both Chrome and Firefox running points to split browser activity, while WinRAR suggests the suspect was handling archives or compressed files.

## Digging into browser history

Since the briefing points to online communication, Chrome is our first stop. Even though Chrome saves historical records to SQLite databases on disk (`History`), active processes keep in-memory SQLite cache buffers, URL strings, and tab session data in RAM.

We run the `chromehistory` plugin against the dump:

```bash
volatility --plugins=/path/to/plugins -f MemoryDump_Lab6.raw --profile=Win7SP1x64 chromehistory
```

The plugin recovers a Pastebin URL:

```text
https://pastebin.com/RSGSi1hk
```

Opening the paste content gives us an outbound Google redirect link:

```text
https://www.google.com/url?q=https://docs.google.com/document/d/1lptcksPt1l_w7Y29V4o6vkEnHToAPqiCkgNNZfS9rCk/edit?usp%3Dsharing&sa=D&source=hangouts&ust=1566208765722000&usg=AFQjCNHXd6Ck6F22MNQEsxdZo21JayPKug
```

Following the redirect leads to a Google Doc with a cloud storage link:

```text
https://mega.nz/#!SrxQxYTQ
```

The document also includes a short message:
> "But David sent the key in mail. The key is... :("

## Carving the Mega decryption key from memory

The Mega link is incomplete. Standard Mega URLs use the following format:

```text
https://mega.nz/#!<file_id>!<decryption_key>
```

We have the file ID (`SrxQxYTQ`), but Mega uses client-side AES encryption where the 128-bit master key is passed in the URL fragment after the second exclamation mark. Without that key, Mega cannot decrypt the download payload.

Because the associate read the email in a webmail tab or messaging client, that text had to pass through physical RAM when the browser fetched it. We search raw memory strings for the phrase mentioned in the note:

```bash
strings -a -e l MemoryDump_Lab6.raw | grep -i "The key is"
# Or searching single-byte ASCII:
strings -a MemoryDump_Lab6.raw | grep -i "The key is"
```

The search hits:

```text
The key is: zyWxCjCYYSEMA-hZe552qWVXiPwa5TecODbjnsscMIU
```

We append this key to complete the URL:

```text
https://mega.nz/#!SrxQxYTQ!zyWxCjCYYSEMA-hZe552qWVXiPwa5TecODbjnsscMIU
```

Downloading the file gives us `flag1.png`.

## Repairing the PNG header

When we try to open `flag1.png` in an image viewer, it fails with a decode error.

![corrupt](https://hackmd.io/_uploads/ry-YBUQe-x.png)

We inspect the first few bytes with `xxd`:

```bash
xxd flag1.png | head -n 5
```

![hex_corrupted](https://hackmd.io/_uploads/Hyw9rUQg-l.png)

The PNG file specification requires an 8-byte file signature followed immediately by the 4-byte length and 4-byte chunk type for the Image Header (`IHDR`):

```text
89 50 4E 47 0D 0A 1A 0A  [PNG file signature]
00 00 00 0D 49 48 44 52  [IHDR chunk: length 13, name 'IHDR']
```

In our downloaded file, offset `0x0C` contains `0x69` (lowercase `i`) instead of `0x49` (uppercase `I`):

```text
89 50 4E 47 0D 0A 1A 0A
00 00 00 0D 69 48 44 52  [Broken: 'iHDR']
```

In PNG chunk naming conventions, chunk capitalization conveys properties: an uppercase first letter means the chunk is critical. Because of the lowercase `i`, strict decoders reject the chunk as an invalid critical chunk. We fix byte `0x0C` with a short Python script:

```python
with open("flag1.png", "rb") as f:
    data = bytearray(f.read())

data[12] = 0x49  # replace 'i' with 'I'

with open("flag1_fixed.png", "wb") as f:
    f.write(data)
```

Opening the patched file displays the first part of the flag:

![flag_](https://hackmd.io/_uploads/H1P3H8XxZl.png)

```text
inctf{thi5_cH4LL3Ng3_!s_g0nn4_b3_
```

## Carving the WinRAR archive

To find the second half of the flag, we turn to the active WinRAR process (PID 3716) we spotted earlier. We check `windows.cmdline` to see what archive was opened:

```bash
vol -f MemoryDump_Lab6.raw windows.cmdline
```

Looking at the WinRAR entry:

```text
PID: 3716
Process: WinRAR.exe
CommandLine: "C:\Program Files\WinRAR\WinRAR.exe" "C:\Users\Jaffa\Desktop\flag.rar"
```

The target file is `flag.rar` on user `Jaffa`'s desktop. We scan kernel pool memory for the corresponding file object:

```bash
vol -f MemoryDump_Lab6.raw windows.filescan | grep -i "flag.rar"
```

Output:

```text
0x5fcfc4b0    \Users\Jaffa\Desktop\flag.rar
```

With the virtual address of the `_FILE_OBJECT` structure confirmed, we carve the mapped file from memory:

```bash
vol -f MemoryDump_Lab6.raw -o ./extracted windows.dumpfiles --virtaddr 0x5fcfc4b0
```

This gives us `file.0x5fcfc4b0.0xfa8003668870.dat`. Running `unrar` on the extracted archive asks for a password:

```bash
unrar x file.0x5fcfc4b0.0xfa8003668870.dat
# Enter password (will not be echoed):
```

## Extracting passwords from environment variables

In Windows, process environment variables live in user-mode memory inside the Process Environment Block (PEB), specifically under `_RTL_USER_PROCESS_PARAMETERS->Environment`. This table inherits system variables and holds process-specific configurations.

We scan the environment block using `windows.envars`:

```bash
vol -f MemoryDump_Lab6.raw windows.envars --pid 3716
```

Inside the variable list for the WinRAR process:

```text
PID     Process         Variable        Value
3716    WinRAR.exe      RAR_password    easypeasyvirus
```

The password was left right inside an environment variable. Supplying `easypeasyvirus` to `unrar` extracts `flag2.png`:

```bash
unrar x -peasypeasyvirus file.0x5fcfc4b0.0xfa8003668870.dat
```

Opening `flag2.png`:

![flag2](https://hackmd.io/_uploads/r1NTHIme-l.png)

The image reveals the second fragment:

```text
aN_Am4zINg_!_i_gU3Ss???_}
```

## Flag assembly

Joining both fragments gives us the complete flag:

```text
inctf{thi5_cH4LL3Ng3_!s_g0nn4_b3_aN_Am4zINg_!_i_gU3Ss???_}
```

### Summary of recovered artifacts

1. System profile: Windows 7 SP1 x64 (build 7601)
2. Browser artifact: Chrome in-memory SQLite history pointed to Pastebin (`RSGSi1hk`), which redirected to Google Docs and an incomplete Mega link.
3. Decryption key: Recovered from volatile string memory (`zyWxCjCYYSEMA-hZe552qWVXiPwa5TecODbjnsscMIU`).
4. Header patch: Offset `0x0C` of `flag1.png` corrected from `0x69` (`iHDR`) to `0x49` (`IHDR`).
5. Carved archive: `\Users\Jaffa\Desktop\flag.rar` carved via kernel file object at offset `0x5fcfc4b0`.
6. Credential recovery: WinRAR environment block contained `RAR_password=easypeasyvirus`, unlocking `flag2.png`.
