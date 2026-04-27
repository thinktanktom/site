{ pkgs ? import <nixpkgs> { config.allowUnfree = true; } }:
pkgs.mkShell {
  buildInputs = [
    pkgs.hugo
    pkgs.git
    pkgs.go        # some themes want it; harmless to include
    pkgs.claude-code
  ];
}
