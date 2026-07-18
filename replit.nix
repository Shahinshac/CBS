{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.postgresql
  ];
  env = {
    PYTHON_LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.postgresql
    ];
    PGDATA = "$REPL_HOME/.local/share/postgresql";
  };
}
