@ECHO OFF
IF %1.==. GOTO No1
MD releases\STOWAWAY_v%1_linux
MD releases\STOWAWAY_v%1_macos
MD releases\STOWAWAY_v%1_win
MD releases\STOWAWAY_v%1_linux\DO_NOT_SHARE
MD releases\STOWAWAY_v%1_macos\DO_NOT_SHARE
MD releases\STOWAWAY_v%1_win\DO_NOT_SHARE
MOVE releases\STOWAWAY-linux releases\STOWAWAY_v%1_linux\STOWAWAY
MOVE releases\STOWAWAY-macos releases\STOWAWAY_v%1_macos\STOWAWAY
MOVE releases\STOWAWAY-win.exe releases\STOWAWAY_v%1_win\STOWAWAY.exe
COPY releases\about.txt releases\STOWAWAY_v%1_linux\about.txt
COPY releases\about.txt releases\STOWAWAY_v%1_macos\about.txt
COPY releases\about.txt releases\STOWAWAY_v%1_win\about.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_linux\README.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_macos\README.txt
COPY releases\LICENSE.txt releases\STOWAWAY_v%1_win\README.txt
COPY releases\README.txt releases\STOWAWAY_v%1_linux\LICENSE.txt
COPY releases\README.txt releases\STOWAWAY_v%1_macos\LICENSE.txt
COPY releases\README.txt releases\STOWAWAY_v%1_win\LICENSE.txt
tar.exe -c -f releases\STOWAWAY_v%1_linux.zip releases\STOWAWAY_v%1_linux
tar.exe -c -f releases\STOWAWAY_v%1_macos.zip releases\STOWAWAY_v%1_macos
tar.exe -c -f releases\STOWAWAY_v%1_win.zip releases\STOWAWAY_v%1_win
GOTO End1

:No1
	ECHO No version number passed
GOTO End1

:End1
