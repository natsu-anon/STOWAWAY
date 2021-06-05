@ECHO OFF
IF %1.==. GOTO No1
MD releases\STOWAWAY_v%1_linux
MD releases\STOWAWAY_v%1_macos
MD releases\STOWAWAY_v%1_win
rem MD releases\STOWAWAY_v%1_linux\DO_NOT_SHARE
rem MD releases\STOWAWAY_v%1_macos\DO_NOT_SHARE
rem MD releases\STOWAWAY_v%1_win\DO_NOT_SHARE
COPY releases\STOWAWAY-linux releases\STOWAWAY_v%1_linux\STOWAWAY
COPY releases\STOWAWAY-macos releases\STOWAWAY_v%1_macos\STOWAWAY
COPY releases\STOWAWAY-win.exe releases\STOWAWAY_v%1_win\STOWAWAY.exe
COPY releases\about.txt releases\STOWAWAY_v%1_linux\about.txt
COPY releases\about.txt releases\STOWAWAY_v%1_macos\about.txt
COPY releases\about.txt releases\STOWAWAY_v%1_win\about.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_linux\LICENSE.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_macos\LICENSE.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_win\LICENSE.txt
COPY releases\README.txt releases\STOWAWAY_v%1_linux\README.txt
COPY releases\README.txt releases\STOWAWAY_v%1_macos\README.txt
COPY releases\README.txt releases\STOWAWAY_v%1_win\README.txt
COPY releases\UPGRADING.txt releases\STOWAWAY_v%1_linux\UPGRADING.txt
COPY releases\UPGRADING.txt releases\STOWAWAY_v%1_macos\UPGRADING.txt
COPY releases\UPGRADING.txt releases\STOWAWAY_v%1_win\UPGRADING.txt
DEL releases\STOWAWAY_v%1_linux.7z releases\STOWAWAY_v%1_macos.7z releases\STOWAWAY_v%1_win.7z
CD releases
7z.exe a STOWAWAY_v%1_linux.7z STOWAWAY_v%1_linux
7z.exe a STOWAWAY_v%1_macos.7z STOWAWAY_v%1_macos
7z.exe a STOWAWAY_v%1_win.7z STOWAWAY_v%1_win
GOTO End1

:No1
	ECHO No version number passed
GOTO End1

:End1
