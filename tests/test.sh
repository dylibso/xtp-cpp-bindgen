set -e

# Make sure template is built
cd ../
./bundle.sh
cd tests

# Run through every schema in schemas/
rm -rf output
mkdir output
for file in ./schemas/*.yaml; do
  echo "Generating and testing $file..."
  dir=${file##*/}
  dir=${dir%.yaml}
  xtp plugin init --schema-file $file --template ../bundle --path "output/$dir" -y --feature stub-with-code-samples --name $dir
  cd "output/$dir"
  xtp plugin build
  cd ../..
done
