module.exports = function () {
	help = "\n  STOWAWAY [options]\n\n";
	help += "  Options:\n";
	help += "    -a, --about\t\tbasic gestalt\n";
	help += "    -h, --help\t\toutput usage information\n";
	help += "    -v, --version\toutput version information\n";
	help += "    -c, --channels\tlist channel availability/inavailability with reasons why \x1b[4mNOTE: requires a bot token file\x1b[0m\n";
	help += "  If you don't pass any optional flags, STOWAWAY will launch regularly.\n";
	console.log(help);
};
